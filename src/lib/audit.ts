import type { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

type AuditInput = {
  action: string
  targetType: string
  targetId?: string | null
  actorUserId?: string | null
  metadata?: Record<string, unknown> | null
  request?: NextRequest | Request
}

function getRequestMetadata(request?: NextRequest | Request) {
  if (!request) {
    return { ipAddress: null, userAgent: null }
  }

  const headers = request.headers
  const forwardedFor = headers.get('x-forwarded-for')
  const ipAddress = forwardedFor?.split(',')[0]?.trim() ?? headers.get('x-real-ip')
  const userAgent = headers.get('user-agent')

  return {
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  }
}

export async function writeAuditLog(input: AuditInput) {
  const requestMetadata = getRequestMetadata(input.request)

  try {
    await db.adminAuditLog.create({
      data: {
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        actorUserId: input.actorUserId ?? null,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      },
    })
  } catch (error) {
    logger.error('audit_log_write_failed', {
      action: input.action,
      targetType: input.targetType,
      actorUserId: input.actorUserId ?? null,
      error: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}
