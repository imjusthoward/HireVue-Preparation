import { InterviewSessionStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit'
import { RouteError } from '@/lib/session'
import { buildSessionQuestionView, buildSessionSummary, sessionInclude } from '@/lib/interview/shared'

export async function createInterviewSession(input: {
  userId: string
  templateId: string
  title?: string | null
  request?: Request
}) {
  const template = await db.interviewTemplate.findUnique({
    where: {
      id: input.templateId,
    },
    include: {
      questions: {
        orderBy: {
          orderIndex: 'asc',
        },
      },
    },
  })

  if (!template || !template.isActive) {
    throw new RouteError(404, 'Interview template not found')
  }

  if (template.questions.length === 0) {
    throw new RouteError(409, 'Interview template has no questions')
  }

  const session = await db.interviewSession.create({
    data: {
      userId: input.userId,
      templateId: template.id,
      title: input.title ?? template.title,
      sessionQuestions: {
        create: template.questions.map((question) => ({
          questionId: question.id,
          orderIndex: question.orderIndex,
          prompt: question.prompt,
          guidance: question.guidance,
          rubricSnapshot: question.rubricDefinition ?? undefined,
        })),
      },
    },
    include: sessionInclude(),
  })

  await writeAuditLog({
    action: 'SESSION_CREATED',
    targetType: 'InterviewSession',
    targetId: session.id,
    actorUserId: input.userId,
    metadata: {
      templateId: template.id,
      templateSlug: template.slug,
    },
    request: input.request,
  })

  return {
    session: buildSessionSummary(session),
    questions: session.sessionQuestions.map((question) => buildSessionQuestionView(question)),
  }
}

export async function listUserInterviewSessions(input: {
  userId: string
  status?: InterviewSessionStatus
  limit: number
}) {
  const sessions = await db.interviewSession.findMany({
    where: {
      userId: input.userId,
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: input.limit,
    include: sessionInclude(),
  })

  return sessions.map((session) => buildSessionSummary(session))
}

export async function getUserInterviewSession(input: {
  userId: string
  sessionId: string
}) {
  const session = await db.interviewSession.findFirst({
    where: {
      id: input.sessionId,
      userId: input.userId,
    },
    include: sessionInclude(),
  })

  if (!session) {
    throw new RouteError(404, 'Interview session not found')
  }

  const nextQuestion = session.sessionQuestions.find((question) => !question.answer)

  return {
    session: buildSessionSummary(session),
    questions: session.sessionQuestions.map((question) => buildSessionQuestionView(question)),
    nextQuestion: nextQuestion ? buildSessionQuestionView(nextQuestion) : null,
  }
}

export async function getNextInterviewQuestion(input: {
  userId: string
  sessionId: string
}) {
  const session = await db.interviewSession.findFirst({
    where: {
      id: input.sessionId,
      userId: input.userId,
    },
    include: {
      template: {
        select: {
          id: true,
          slug: true,
          title: true,
          category: true,
        },
      },
      sessionQuestions: {
        orderBy: {
          orderIndex: 'asc',
        },
        include: {
          question: true,
          answer: true,
        },
      },
    },
  })

  if (!session) {
    throw new RouteError(404, 'Interview session not found')
  }

  const totalQuestions = session.sessionQuestions.length
  const answeredQuestions = session.sessionQuestions.filter((question) => question.answer).length
  const nextQuestion = session.sessionQuestions.find((question) => !question.answer)

  return {
    session: {
      id: session.id,
      title: session.title,
      status: session.status,
      template: session.template,
      totalQuestions,
      answeredQuestions,
      completedReports: 0,
      pendingJobs: session.sessionQuestions.some((question) => question.answer) ? 1 : 0,
      overallScore: null,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
    },
    nextQuestion: nextQuestion
      ? {
          id: nextQuestion.id,
          orderIndex: nextQuestion.orderIndex,
          prompt: nextQuestion.prompt,
          guidance: nextQuestion.guidance,
          rubricSnapshot: nextQuestion.question?.rubricDefinition ?? nextQuestion.rubricSnapshot ?? null,
        }
      : null,
  }
}
