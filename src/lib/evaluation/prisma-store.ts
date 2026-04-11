import { EvaluationJobStatus, EvaluationJobType, InterviewSessionStatus } from '@prisma/client'
import { writeAuditLog } from '@/lib/audit'
import { db } from '@/lib/db'
import { submitInterviewAnswer } from '@/lib/interview/submissions'
import { deriveSessionStatus, parseSessionCounts } from '@/lib/interview/shared'
import type {
  ClaimedEvaluationJob,
  ClaimJobOptions,
  CompleteJobInput,
  EvaluationAnswerRecord,
  EvaluationJobRecord,
  EvaluationStore,
  FailJobInput,
  SubmitAnswerInput,
  SubmitAnswerResult,
} from '@/lib/evaluation/types'

function mapJobRecord(job: {
  id: string
  answerId: string
  jobType: EvaluationJobType
  status: EvaluationJobStatus
  attemptCount: number
  maxAttempts: number
  leaseExpiresAt: Date | null
  queuedAt: Date
  startedAt: Date | null
  completedAt: Date | null
  lastError: string | null
  inputFingerprint: string | null
  provider: string | null
}): EvaluationJobRecord {
  return {
    id: job.id,
    answerId: job.answerId,
    jobType: job.jobType,
    status: job.status,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    leaseExpiresAt: job.leaseExpiresAt,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    lastError: job.lastError,
    inputFingerprint: job.inputFingerprint,
    provider: job.provider,
  }
}

function mapAnswerRecord(job: {
  answer: {
    id: string
    sessionQuestionId: string
    clientSubmissionId: string
    responseText: string
    sessionQuestion: {
      id: string
      prompt: string
      guidance: string | null
      rubricSnapshot: unknown
      session: {
        id: string
        title: string | null
        template: {
          title: string
          category: string
        }
      }
    }
  }
}): EvaluationAnswerRecord {
  return {
    answerId: job.answer.id,
    sessionId: job.answer.sessionQuestion.session.id,
    sessionQuestionId: job.answer.sessionQuestion.id,
    clientSubmissionId: job.answer.clientSubmissionId,
    sessionTitle: job.answer.sessionQuestion.session.title,
    templateTitle: job.answer.sessionQuestion.session.template.title,
    templateCategory: job.answer.sessionQuestion.session.template.category,
    prompt: job.answer.sessionQuestion.prompt,
    guidance: job.answer.sessionQuestion.guidance,
    responseText: job.answer.responseText,
    rubricSnapshot: job.answer.sessionQuestion.rubricSnapshot,
  }
}

export function createPrismaEvaluationStore(): EvaluationStore {
  return {
    async submitAnswer(input: SubmitAnswerInput): Promise<SubmitAnswerResult> {
      return submitInterviewAnswer(input)
    },

    async claimNextJob(options: ClaimJobOptions): Promise<ClaimedEvaluationJob | null> {
      const now = options.now ?? new Date()
      const leaseMs = options.leaseMs ?? 120_000

      const candidate = await db.evaluationJob.findFirst({
        where: {
          jobType: EvaluationJobType.ANSWER_EVALUATION,
          status: {
            in: [EvaluationJobStatus.QUEUED, EvaluationJobStatus.IN_PROGRESS],
          },
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
          answer: {
            feedbackReport: null,
          },
        },
        orderBy: {
          queuedAt: 'asc',
        },
        include: {
          answer: {
            include: {
              sessionQuestion: {
                include: {
                  session: {
                    include: {
                      template: true,
                    },
                  },
                },
              },
            },
          },
        },
      })

      if (!candidate) {
        return null
      }

      const updated = await db.evaluationJob.update({
        where: {
          id: candidate.id,
        },
        data: {
          status: EvaluationJobStatus.IN_PROGRESS,
          attemptCount: candidate.attemptCount + 1,
          startedAt: candidate.startedAt ?? now,
          leaseExpiresAt: new Date(now.getTime() + leaseMs),
          lastError: null,
        },
      })

      return {
        job: mapJobRecord(updated),
        answer: mapAnswerRecord(candidate),
      }
    },

    async completeJob(input: CompleteJobInput): Promise<void> {
      const now = input.now ?? new Date()

      await db.$transaction(async (tx) => {
        await tx.evaluationJob.update({
          where: {
            id: input.job.id,
          },
          data: {
            status: EvaluationJobStatus.SUCCEEDED,
            completedAt: now,
            leaseExpiresAt: null,
            lastError: null,
          },
        })

        await tx.feedbackReport.upsert({
          where: {
            answerId: input.answer.answerId,
          },
          update: {
            sessionId: input.answer.sessionId,
            overallScore: input.report.overallScore,
            recommendation: input.report.recommendation,
            summary: input.report.summary,
            rubricScores: input.report.rubricScores,
            strengths: input.report.strengths,
            improvementAreas: input.report.improvementAreas,
            evaluatorVersion: input.report.evaluatorVersion,
          },
          create: {
            sessionId: input.answer.sessionId,
            answerId: input.answer.answerId,
            overallScore: input.report.overallScore,
            recommendation: input.report.recommendation,
            summary: input.report.summary,
            rubricScores: input.report.rubricScores,
            strengths: input.report.strengths,
            improvementAreas: input.report.improvementAreas,
            evaluatorVersion: input.report.evaluatorVersion,
          },
        })

        const session = await tx.interviewSession.findUnique({
          where: {
            id: input.answer.sessionId,
          },
          include: {
            sessionQuestions: {
              include: {
                answer: {
                  include: {
                    feedbackReport: true,
                    evaluationJobs: {
                      select: {
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        })

        if (!session) {
          return
        }

        const counts = parseSessionCounts(session)
        const nextStatus = deriveSessionStatus({
          totalQuestions: counts.totalQuestions,
          answeredQuestions: counts.answeredQuestions,
          completedReports: counts.completedReports,
          pendingJobs: counts.pendingJobs,
          previousStatus: session.status,
        })

        await tx.interviewSession.update({
          where: {
            id: session.id,
          },
          data: {
            status: nextStatus,
            completedAt: nextStatus === InterviewSessionStatus.COMPLETED ? now : session.completedAt,
            lastActivityAt: now,
          },
        })
      })

      await writeAuditLog({
        action: 'EVALUATION_JOB_COMPLETED',
        targetType: 'EvaluationJob',
        targetId: input.job.id,
        metadata: {
          answerId: input.answer.answerId,
          provider: input.report.provider,
        },
      })
    },

    async failJob(input: FailJobInput): Promise<{ status: EvaluationJobStatus; attemptCount: number }> {
      const now = input.now ?? new Date()
      const nextStatus =
        input.job.attemptCount >= input.job.maxAttempts ? EvaluationJobStatus.FAILED : EvaluationJobStatus.QUEUED

      const updated = await db.evaluationJob.update({
        where: {
          id: input.job.id,
        },
        data: {
          status: nextStatus,
          completedAt: nextStatus === EvaluationJobStatus.FAILED ? now : null,
          startedAt: nextStatus === EvaluationJobStatus.QUEUED ? null : input.job.startedAt,
          leaseExpiresAt: null,
          lastError: input.error.message,
          queuedAt: nextStatus === EvaluationJobStatus.QUEUED ? now : input.job.queuedAt,
        },
      })

      return {
        status: updated.status,
        attemptCount: updated.attemptCount,
      }
    },

    async getJobByAnswerId(answerId: string): Promise<EvaluationJobRecord | null> {
      const job = await db.evaluationJob.findFirst({
        where: {
          answerId,
        },
      })

      return job ? mapJobRecord(job) : null
    },
  }
}
