import { EvaluationJobStatus, InterviewSessionStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit'
import { RouteError } from '@/lib/session'
import {
  adminSessionInclude,
  buildSessionQuestionView,
  buildSessionSummary,
  extractSessionFeedbackArtifact,
} from '@/lib/interview/shared'

export async function listAdminInterviewSessions(input: {
  status?: InterviewSessionStatus
  search?: string
  limit: number
}) {
  const sessions = await db.interviewSession.findMany({
    where: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              {
                title: {
                  contains: input.search,
                  mode: 'insensitive',
                },
              },
              {
                template: {
                  title: {
                    contains: input.search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                user: {
                  email: {
                    contains: input.search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                user: {
                  name: {
                    contains: input.search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: input.limit,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
      template: {
        select: {
          id: true,
          slug: true,
          title: true,
          category: true,
        },
      },
      sessionQuestions: {
        include: {
          answer: {
            include: {
              feedbackReport: true,
              evaluationJobs: true,
            },
          },
        },
      },
    },
  })

  return sessions.map((session) => ({
    ...buildSessionSummary(session),
    user: session.user,
  }))
}

export async function getAdminInterviewSession(input: {
  sessionId: string
}) {
  const session = await db.interviewSession.findUnique({
    where: {
      id: input.sessionId,
    },
    include: adminSessionInclude(),
  })

  if (!session) {
    throw new RouteError(404, 'Interview session not found')
  }

  return {
    session: buildSessionSummary(session),
    user: session.user,
    questions: session.sessionQuestions.map((question) => buildSessionQuestionView(question)),
    report: extractSessionFeedbackArtifact({
      title: session.title,
      template: session.template,
      sessionQuestions: session.sessionQuestions.map((question) => ({
        id: question.id,
        orderIndex: question.orderIndex,
        prompt: question.prompt,
        guidance: question.guidance,
        answer: question.answer
          ? {
              responseText: question.answer.responseText,
              feedbackReport: question.answer.feedbackReport,
            }
          : null,
      })),
    }),
  }
}

export async function retryEvaluationJob(input: {
  jobId: string
  actorUserId: string
  request?: Request
}) {
  const job = await db.evaluationJob.findUnique({
    where: {
      id: input.jobId,
    },
    include: {
      answer: {
        include: {
          sessionQuestion: {
            include: {
              session: true,
            },
          },
        },
      },
    },
  })

  if (!job) {
    throw new RouteError(404, 'Evaluation job not found')
  }

  if (job.status !== EvaluationJobStatus.FAILED) {
    throw new RouteError(409, 'Only failed jobs can be retried')
  }

  const updated = await db.evaluationJob.update({
    where: {
      id: job.id,
    },
    data: {
      status: EvaluationJobStatus.QUEUED,
      attemptCount: 0,
      startedAt: null,
      completedAt: null,
      lastError: null,
      leaseExpiresAt: null,
      queuedAt: new Date(),
    },
  })

  await db.interviewSession.update({
    where: {
      id: job.answer.sessionQuestion.session.id,
    },
    data: {
      status: InterviewSessionStatus.EVALUATING,
      lastActivityAt: new Date(),
    },
  })

  await writeAuditLog({
    action: 'EVALUATION_JOB_REQUEUED',
    targetType: 'EvaluationJob',
    targetId: job.id,
    actorUserId: input.actorUserId,
    metadata: {
      answerId: job.answerId,
    },
    request: input.request,
  })

  return {
    jobId: updated.id,
    status: updated.status,
    attemptCount: updated.attemptCount,
  }
}
