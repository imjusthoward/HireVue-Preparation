import { NextResponse } from 'next/server'
import { InterviewSessionStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { handleRouteError, requireUserSession } from '@/lib/session'
import { sessionRouteParamsSchema } from '@/lib/validation/sessions'

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const authSession = await requireUserSession()
    const params = sessionRouteParamsSchema.parse(await context.params)

    const interviewSession = await db.interviewSession.findFirst({
      where: {
        id: params.sessionId,
        userId: authSession.user.id,
      },
      select: {
        id: true,
        status: true,
        sessionQuestions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            answer: {
              select: {
                id: true,
                createdAt: true,
              },
            },
          },
        },
      },
    })

    if (!interviewSession) {
      return NextResponse.json({ error: 'Interview session not found' }, { status: 404 })
    }

    if (interviewSession.status !== InterviewSessionStatus.IN_PROGRESS) {
      return NextResponse.json({ error: 'Interview session is not accepting answers' }, { status: 409 })
    }

    const nextQuestion = interviewSession.sessionQuestions.find((question) => question.answer === null)

    if (!nextQuestion) {
      return NextResponse.json({ question: null, done: true })
    }

    return NextResponse.json({
      question: {
        id: nextQuestion.id,
        orderIndex: nextQuestion.orderIndex,
        prompt: nextQuestion.prompt,
        guidance: nextQuestion.guidance,
      },
      done: false,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch next question')
  }
}
