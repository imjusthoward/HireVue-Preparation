import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit'
import { handleRouteError, requireAdminSession } from '@/lib/session'
import { adminSessionsQuerySchema } from '@/lib/validation/sessions'

export async function GET(request: Request) {
  try {
    const adminSession = await requireAdminSession()
    const { searchParams } = new URL(request.url)
    const query = adminSessionsQuerySchema.parse({
      limit: searchParams.get('limit') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    })

    const sessions = await db.interviewSession.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: 'insensitive' } },
                { user: { email: { contains: query.search, mode: 'insensitive' } } },
                { user: { name: { contains: query.search, mode: 'insensitive' } } },
                { template: { title: { contains: query.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
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
            title: true,
            category: true,
            createdAt: true,
          },
        },
        feedbackReports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            recommendation: true,
            summary: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            sessionQuestions: true,
          },
        },
      },
    })

    await writeAuditLog({
      action: 'admin.interview_sessions.list',
      targetType: 'InterviewSession',
      actorUserId: adminSession.user.id,
      metadata: {
        limit: query.limit,
        status: query.status ?? null,
        search: query.search ?? null,
        resultCount: sessions.length,
      },
      request,
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch admin interview sessions')
  }
}
