import { NextResponse } from 'next/server'
import { getAuthSession, handleRouteError } from '@/lib/session'

export async function GET() {
  try {
    const session = await getAuthSession()

    return NextResponse.json({
      authenticated: Boolean(session?.user?.id),
      user: session?.user ?? null,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch session')
  }
}
