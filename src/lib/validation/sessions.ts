import { z } from 'zod'
import { cuidSchema, paginationSchema, routeIdParamsSchema, sessionStatusFilterSchema } from '@/lib/validation/common'

export const createInterviewSessionSchema = z
  .object({
    templateId: cuidSchema,
    title: z.string().trim().min(3).max(120).optional(),
  })
  .strict()

export const submitAnswerSchema = z
  .object({
    sessionQuestionId: cuidSchema,
    clientSubmissionId: z.string().trim().min(8).max(120),
    responseText: z.string().trim().min(1).max(6000),
  })
  .strict()

export const historyQuerySchema = paginationSchema.extend({
  status: sessionStatusFilterSchema,
})

export const adminSessionsQuerySchema = paginationSchema.extend({
  status: sessionStatusFilterSchema,
  search: z.string().trim().min(1).max(120).optional(),
})

export const sessionRouteParamsSchema = routeIdParamsSchema
