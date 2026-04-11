import { EvaluationJobStatus, InterviewSessionStatus, type Prisma } from '@prisma/client'
import { EVALUATOR_VERSION, buildSessionFeedbackArtifact } from '@/lib/evaluation/engine'

export function sessionInclude() {
  return {
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
        orderIndex: 'asc' as const,
      },
      include: {
        question: true,
        answer: {
          include: {
            feedbackReport: true,
            evaluationJobs: true,
          },
        },
      },
    },
  } as const
}

export function adminSessionInclude() {
  return {
    user: {
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
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
      orderBy: {
        orderIndex: 'asc' as const,
      },
      include: {
        question: true,
        answer: {
          include: {
            feedbackReport: true,
            evaluationJobs: true,
          },
        },
      },
    },
  } as const
}

export function buildTemplateCard(template: {
  id: string
  slug: string
  title: string
  description: string | null
  category: string
  isActive: boolean
  questions: Array<{
    id: string
    prompt: string
    guidance: string | null
    orderIndex: number
  }>
}) {
  return {
    id: template.id,
    slug: template.slug,
    title: template.title,
    description: template.description,
    category: template.category,
    isActive: template.isActive,
    questionCount: template.questions.length,
    sampleQuestions: template.questions.slice(0, 3).map((question) => ({
      id: question.id,
      prompt: question.prompt,
      guidance: question.guidance,
      orderIndex: question.orderIndex,
    })),
  }
}

export function buildSessionQuestionView(question: {
  id: string
  orderIndex: number
  prompt: string
  guidance: string | null
  rubricSnapshot: Prisma.JsonValue | null
  question: {
    id: string
    prompt: string
    guidance: string | null
    orderIndex: number
    rubricDefinition: Prisma.JsonValue | null
  } | null
  answer: {
    id: string
    clientSubmissionId: string
    responseText: string
    createdAt: Date
    feedbackReport: {
      overallScore: number
      recommendation: string
      summary: string
      rubricScores: Prisma.JsonValue
      strengths: Prisma.JsonValue
      improvementAreas: Prisma.JsonValue
      evaluatorVersion: string | null
    } | null
    evaluationJobs: Array<{
      id: string
      status: EvaluationJobStatus
      attemptCount: number
      maxAttempts: number
      lastError: string | null
      provider: string | null
      queuedAt: Date
      startedAt: Date | null
      completedAt: Date | null
    }>
  } | null
}) {
  return {
    id: question.id,
    orderIndex: question.orderIndex,
    prompt: question.prompt,
    guidance: question.guidance,
    rubricSnapshot: question.rubricSnapshot,
    sourceQuestion: question.question
      ? {
          id: question.question.id,
          prompt: question.question.prompt,
          guidance: question.question.guidance,
          orderIndex: question.question.orderIndex,
          rubricDefinition: question.question.rubricDefinition,
        }
      : null,
    answer: question.answer
      ? {
          id: question.answer.id,
          clientSubmissionId: question.answer.clientSubmissionId,
          responseText: question.answer.responseText,
          createdAt: question.answer.createdAt,
          feedbackReport: question.answer.feedbackReport,
          evaluationJobs: question.answer.evaluationJobs.map((job) => ({
            id: job.id,
            status: job.status,
            attemptCount: job.attemptCount,
            maxAttempts: job.maxAttempts,
            lastError: job.lastError,
            provider: job.provider,
            queuedAt: job.queuedAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
          })),
        }
      : null,
  }
}

export function parseSessionCounts(session: {
  sessionQuestions: Array<{
    answer: {
      feedbackReport: { overallScore: number } | null
      evaluationJobs: Array<{ status: EvaluationJobStatus }>
    } | null
  }>
}) {
  const totalQuestions = session.sessionQuestions.length
  const answeredQuestions = session.sessionQuestions.filter((question) => question.answer).length
  const completedReports = session.sessionQuestions.filter((question) => question.answer?.feedbackReport).length
  const pendingJobs = session.sessionQuestions.filter((question) =>
    question.answer?.evaluationJobs.some((job) => job.status === EvaluationJobStatus.QUEUED || job.status === EvaluationJobStatus.IN_PROGRESS),
  ).length

  return {
    totalQuestions,
    answeredQuestions,
    completedReports,
    pendingJobs,
  }
}

export function deriveSessionStatus(input: {
  totalQuestions: number
  answeredQuestions: number
  completedReports: number
  pendingJobs: number
  previousStatus: InterviewSessionStatus
}) {
  if (input.totalQuestions === 0) {
    return InterviewSessionStatus.CANCELLED
  }

  if (input.completedReports === input.totalQuestions && input.answeredQuestions === input.totalQuestions) {
    return InterviewSessionStatus.COMPLETED
  }

  if (input.pendingJobs > 0 || input.completedReports > 0) {
    return InterviewSessionStatus.EVALUATING
  }

  if (input.previousStatus === InterviewSessionStatus.FAILED) {
    return InterviewSessionStatus.FAILED
  }

  return InterviewSessionStatus.IN_PROGRESS
}

export function toSessionFeedbackQuestion(question: {
  id: string
  orderIndex: number
  prompt: string
  guidance: string | null
  answer: {
    responseText: string
    feedbackReport: {
      overallScore: number
      recommendation: string
      summary: string
      rubricScores: Prisma.JsonValue
      strengths: Prisma.JsonValue
      improvementAreas: Prisma.JsonValue
      evaluatorVersion: string | null
    } | null
  } | null
}) {
  if (!question.answer?.feedbackReport) {
    return null
  }

  return {
    questionId: question.id,
    orderIndex: question.orderIndex,
    prompt: question.prompt,
    guidance: question.guidance,
    answerText: question.answer.responseText,
    report: {
      overallScore: question.answer.feedbackReport.overallScore,
      recommendation: question.answer.feedbackReport.recommendation as 'strong_yes' | 'yes' | 'borderline' | 'no',
      summary: question.answer.feedbackReport.summary,
      rubricScores: question.answer.feedbackReport.rubricScores as {
        clarity: number
        structure: number
        specificity: number
        businessJudgment: number
        communication: number
      },
      strengths: question.answer.feedbackReport.strengths as string[],
      improvementAreas: question.answer.feedbackReport.improvementAreas as string[],
      provider: 'demo' as const,
      evaluatorVersion: question.answer.feedbackReport.evaluatorVersion ?? EVALUATOR_VERSION,
    },
  }
}

export function extractSessionFeedbackArtifact(session: {
  title: string | null
  template: {
    title: string
  }
  sessionQuestions: Array<{
    id: string
    orderIndex: number
    prompt: string
    guidance: string | null
    answer: {
      responseText: string
      feedbackReport: {
        overallScore: number
        recommendation: string
        summary: string
        rubricScores: Prisma.JsonValue
        strengths: Prisma.JsonValue
        improvementAreas: Prisma.JsonValue
        evaluatorVersion: string | null
      } | null
    } | null
  }>
}) {
  const questionFeedback = session.sessionQuestions
    .map((question) => toSessionFeedbackQuestion(question))
    .filter((question): question is NonNullable<typeof question> => Boolean(question))

  return buildSessionFeedbackArtifact({
    sessionTitle: session.title,
    templateTitle: session.template.title,
    questions: questionFeedback,
  })
}

export function buildSessionSummary(session: {
  id: string
  title: string | null
  status: InterviewSessionStatus
  startedAt: Date
  completedAt: Date | null
  lastActivityAt: Date
  createdAt: Date
  template: {
    id: string
    slug: string
    title: string
    category: string
  }
  sessionQuestions: Array<{
    answer: {
      feedbackReport: { overallScore: number } | null
      evaluationJobs: Array<{ status: EvaluationJobStatus }>
    } | null
  }>
}) {
  const counts = parseSessionCounts(session)
  const scores = session.sessionQuestions
    .map((question) => question.answer?.feedbackReport?.overallScore)
    .filter((score): score is number => typeof score === 'number')

  const overallScore = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null

  return {
    id: session.id,
    title: session.title,
    status: session.status,
    template: session.template,
    totalQuestions: counts.totalQuestions,
    answeredQuestions: counts.answeredQuestions,
    completedReports: counts.completedReports,
    pendingJobs: counts.pendingJobs,
    overallScore,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    lastActivityAt: session.lastActivityAt,
    createdAt: session.createdAt,
  }
}
