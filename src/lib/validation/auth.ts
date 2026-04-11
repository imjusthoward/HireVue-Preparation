import { z } from 'zod'

const normalizedEmailSchema = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase())

export const credentialsSchema = z
  .object({
    email: normalizedEmailSchema,
    password: z.string().min(8).max(72),
  })
  .strict()

export const registerSchema = z
  .object({
    email: normalizedEmailSchema,
    password: z.string().min(8).max(72),
    name: z.string().trim().min(2).max(120).optional(),
  })
  .strict()
