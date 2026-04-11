import { z } from 'zod'

export const cuidSchema = z.string().cuid()

export const sessionStatusFilterSchema = z
  .enum(['IN_PROGRESS', 'EVALUATING', 'COMPLETED', 'FAILED', 'CANCELLED'])
  .optional()

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const routeIdParamsSchema = z.object({
  sessionId: cuidSchema,
})

export function parseBoolean(value: string | null) {
  if (!value) {
    return false
  }

  return value === '1' || value.toLowerCase() === 'true'
}
