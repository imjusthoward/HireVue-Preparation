import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
  pool?: Pool
}

const defaultDatabaseUrl = 'postgresql://postgres:postgres@localhost:5432/interview_prep'

function createPool() {
  const connectionString = process.env.DATABASE_URL || defaultDatabaseUrl

  return new Pool({ connectionString })
}

const pool = globalForPrisma.pool ?? createPool()

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.pool = pool
  globalForPrisma.prisma = db
}
