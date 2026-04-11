import type { Session } from 'next-auth'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma, UserRole } from '@prisma/client'
import { ZodError } from 'zod'
import { authOptions } from '@/lib/auth/options'
import { logger } from '@/lib/logger'

export class RouteError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function getAuthSession() {
  return getServerSession(authOptions)
}

export async function requireUserSession() {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    throw new RouteError(401, 'Authentication required')
  }

  return session
}

export async function requireAdminSession() {
  const session = await requireUserSession()

  if (session.user.role !== UserRole.ADMIN) {
    throw new RouteError(403, 'Admin access required')
  }

  return session
}

export function getActorFromSession(session: Session) {
  return {
    userId: session.user.id,
    role: session.user.role,
    email: session.user.email ?? null,
  }
}

export function assertSessionOwnership(sessionUserId: string, ownerUserId: string) {
  if (sessionUserId !== ownerUserId) {
    throw new RouteError(404, 'Resource not found')
  }
}

function getPrismaErrorMessage(error: Prisma.PrismaClientKnownRequestError) {
  switch (error.code) {
    case 'P2002':
      return 'Resource already exists'
    case 'P2025':
      return 'Resource not found'
    default:
      return null
  }
}

export function handleRouteError(error: unknown, fallbackMessage = 'Internal server error') {
  if (error instanceof RouteError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Invalid request',
        details: error.flatten(),
      },
      { status: 400 },
    )
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const message = getPrismaErrorMessage(error) ?? fallbackMessage
    const status = error.code === 'P2025' ? 404 : error.code === 'P2002' ? 409 : 400

    return NextResponse.json({ error: message }, { status })
  }

  logger.error('route_handler_failed', {
    error: error instanceof Error ? error.message : fallbackMessage,
  })

  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}
