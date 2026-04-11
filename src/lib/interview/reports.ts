import { db } from '@/lib/db'
import { RouteError } from '@/lib/session'
import { extractSessionFeedbackArtifact, parseSessionCounts, sessionInclude } from '@/lib/interview/shared'

export async function getSessionReport(input: {
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

  const questionFeedback = session.sessionQuestions.filter((question) => question.answer?.feedbackReport).length

  if (questionFeedback === 0) {
    return {
      ready: false,
      status: session.status,
      sessionId: session.id,
      progress: parseSessionCounts(session),
    }
  }

  return {
    ready: true,
    status: session.status,
    sessionId: session.id,
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
