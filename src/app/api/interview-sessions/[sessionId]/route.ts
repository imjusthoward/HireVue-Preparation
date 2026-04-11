import { NextResponse } from 'next/server'
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
      include: {
        template: {
          select: {
            id: true,
            title: true,
            category: true,
            createdAt: true,
          },
        },
        sessionQuestions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            answer: {
              select: {
                id: true,
                clientSubmissionId: true,
                responseText: true,
                createdAt: true,
                evaluationJobs: {
                  orderBy: { createdAt: 'desc' },
                  select: {
                    id: true,
                    jobType: true,
                    status: true,
                    attemptCount: true,
                    maxAttempts: true,
                    queuedAt: true,
                    leaseExpiresAt: true,
                    startedAt: true,
                    completedAt: true,
                    lastError: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
        feedbackReports: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!interviewSession) {
      return NextResponse.json({ error: 'Interview session not found' }, { status: 404 })
    }

    return NextResponse.json({ session: interviewSession })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch interview session')
  }
}
