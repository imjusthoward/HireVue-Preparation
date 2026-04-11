import { NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { handleRouteError } from '@/lib/session'
import { registerSchema } from '@/lib/validation/auth'

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json())
    const passwordHash = await hashPassword(body.password)

    const user = await db.user.create({
      data: {
        email: body.email,
        passwordHash,
        name: body.name,
        role: UserRole.USER,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Failed to register user')
  }
}
