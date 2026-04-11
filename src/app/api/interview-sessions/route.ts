import { NextResponse } from 'next/server'
import { InterviewSessionStatus, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { handleRouteError, requireUserSession } from '@/lib/session'
import { createInterviewSessionSchema, historyQuerySchema } from '@/lib/validation/sessions'

export async function POST(request: Request) {
  try {
    const session = await requireUserSession()
    const body = createInterviewSessionSchema.parse(await request.json())

    const template = await db.interviewTemplate.findUnique({
      where: { id: body.templateId },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            orderIndex: true,
            prompt: true,
            guidance: true,
            rubricDefinition: true,
          },
        },
      },
    })

    if (!template || !template.isActive) {
      return NextResponse.json({ error: 'Interview template not available' }, { status: 404 })
    }

    if (template.questions.length === 0) {
      return NextResponse.json({ error: 'Interview template has no active questions' }, { status: 400 })
    }

    const interviewSession = await db.interviewSession.create({
      data: {
        userId: session.user.id,
        templateId: template.id,
        title: body.title ?? template.title,
        status: InterviewSessionStatus.IN_PROGRESS,
        sessionQuestions: {
          create: template.questions.map((question) => ({
            questionId: question.id,
            orderIndex: question.orderIndex,
            prompt: question.prompt,
            guidance: question.guidance,
            rubricSnapshot:
              question.rubricDefinition === null
                ? Prisma.JsonNull
                : (question.rubricDefinition as Prisma.InputJsonValue),
          })),
        },
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
                createdAt: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ session: interviewSession }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Failed to create interview session')
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireUserSession()
    const { searchParams } = new URL(request.url)
    const query = historyQuerySchema.parse({
      limit: searchParams.get('limit') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    })

    const sessions = await db.interviewSession.findMany({
      where: {
        userId: session.user.id,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
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
                createdAt: true,
              },
            },
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
      },
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch interview history')
  }
}
