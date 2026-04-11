import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { UserRole } from '@prisma/client'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import { credentialsSchema } from '@/lib/validation/auth'

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(rawCredentials) {
        const parsedCredentials = credentialsSchema.safeParse(rawCredentials)

        if (!parsedCredentials.success) {
          return null
        }

        const user = await db.user.findUnique({
          where: {
            email: parsedCredentials.data.email,
          },
        })

        if (!user || !user.isActive) {
          return null
        }

        const isValid = await verifyPassword(parsedCredentials.data.password, user.passwordHash)

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
        token.email = user.email
        token.name = user.name ?? undefined
        token.role = user.role ?? UserRole.USER
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ''
        session.user.role = (token.role as UserRole | undefined) ?? UserRole.USER
        session.user.email = token.email ?? session.user.email ?? null
        session.user.name = token.name ?? session.user.name ?? null
      }

      return session
    },
  },
}
