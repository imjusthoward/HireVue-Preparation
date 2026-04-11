import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit'
import { handleRouteError, requireAdminSession } from '@/lib/session'
import { sessionRouteParamsSchema } from '@/lib/validation/sessions'

export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const adminSession = await requireAdminSession()
    const params = sessionRouteParamsSchema.parse(await context.params)

    const interviewSession = await db.interviewSession.findUnique({
      where: { id: params.sessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        },
        template: {
          select: {
            id: true,
            title: true,
            category: true,
            createdAt: true,
            isActive: true,
          },
        },
        sessionQuestions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            answer: {
              include: {
                evaluationJobs: {
                  orderBy: { createdAt: 'desc' },
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

    await writeAuditLog({
      action: 'admin.interview_sessions.read',
      targetType: 'InterviewSession',
      targetId: interviewSession.id,
      actorUserId: adminSession.user.id,
      metadata: {
        userId: interviewSession.userId,
        status: interviewSession.status,
      },
      request,
    })

    return NextResponse.json({ session: interviewSession })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch admin interview session')
  }
}
