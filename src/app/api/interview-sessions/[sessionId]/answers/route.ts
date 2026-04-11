import { NextResponse } from 'next/server'
import { EvaluationJobStatus, EvaluationJobType, InterviewSessionStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { handleRouteError, requireUserSession } from '@/lib/session'
import { sessionRouteParamsSchema, submitAnswerSchema } from '@/lib/validation/sessions'

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const authSession = await requireUserSession()
    const params = sessionRouteParamsSchema.parse(await context.params)
    const body = submitAnswerSchema.parse(await request.json())

    const result = await db.$transaction(async (tx) => {
      const interviewSession = await tx.interviewSession.findFirst({
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
                  clientSubmissionId: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      })

      if (!interviewSession) {
        return { kind: 'not_found' as const }
      }

      if (interviewSession.status !== InterviewSessionStatus.IN_PROGRESS) {
        return { kind: 'invalid_status' as const }
      }

      const targetQuestion = interviewSession.sessionQuestions.find((question) => question.id === body.sessionQuestionId)

      if (!targetQuestion) {
        return { kind: 'question_not_found' as const }
      }

      if (targetQuestion.answer) {
        if (targetQuestion.answer.clientSubmissionId === body.clientSubmissionId) {
          return {
            kind: 'idempotent' as const,
            answer: targetQuestion.answer,
            completed: false,
          }
        }

        return { kind: 'already_answered' as const }
      }

      const nextPendingQuestion = interviewSession.sessionQuestions.find((question) => question.answer === null)

      if (!nextPendingQuestion || nextPendingQuestion.id !== targetQuestion.id) {
        return { kind: 'out_of_order' as const }
      }

      const answer = await tx.answer.create({
        data: {
          sessionQuestionId: targetQuestion.id,
          clientSubmissionId: body.clientSubmissionId,
          responseText: body.responseText,
        },
        select: {
          id: true,
          sessionQuestionId: true,
          clientSubmissionId: true,
          createdAt: true,
        },
      })

      const hasRemainingQuestions = interviewSession.sessionQuestions.some(
        (question) => question.id !== targetQuestion.id && question.answer === null,
      )

      if (hasRemainingQuestions) {
        return {
          kind: 'answered' as const,
          answer,
          completed: false,
        }
      }

      await tx.interviewSession.update({
        where: { id: interviewSession.id },
        data: {
          status: InterviewSessionStatus.EVALUATING,
          completedAt: new Date(),
        },
      })

      await tx.evaluationJob.create({
        data: {
          answerId: answer.id,
          jobType: EvaluationJobType.ANSWER_EVALUATION,
          status: EvaluationJobStatus.QUEUED,
        },
      })

      return {
        kind: 'answered' as const,
        answer,
        completed: true,
      }
    })

    switch (result.kind) {
      case 'not_found':
        return NextResponse.json({ error: 'Interview session not found' }, { status: 404 })
      case 'invalid_status':
        return NextResponse.json({ error: 'Interview session is not accepting answers' }, { status: 409 })
      case 'question_not_found':
        return NextResponse.json({ error: 'Question not found in interview session' }, { status: 404 })
      case 'out_of_order':
        return NextResponse.json({ error: 'Answers must be submitted in order' }, { status: 409 })
      case 'already_answered':
        return NextResponse.json({ error: 'Question already answered' }, { status: 409 })
      case 'idempotent':
      case 'answered':
        return NextResponse.json({
          answer: result.answer,
          completed: result.completed,
        })
    }
  } catch (error) {
    return handleRouteError(error, 'Failed to submit answer')
  }
}
