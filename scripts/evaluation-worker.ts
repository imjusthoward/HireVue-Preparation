import { setTimeout as delay } from 'node:timers/promises'
import { logger } from '@/lib/logger'
import { createPrismaEvaluationStore } from '@/lib/evaluation/prisma-store'
import { processOneEvaluationJob } from '@/lib/evaluation/service'

const controller = new AbortController()

for (const event of ['SIGINT', 'SIGTERM']) {
  process.on(event, () => {
    logger.info('Received shutdown signal for evaluation worker', { event })
    controller.abort()
  })
}

const store = createPrismaEvaluationStore()

const workerId = process.env.EVALUATION_WORKER_ID || `worker-${process.pid}`
const leaseMs = Number.parseInt(process.env.EVALUATION_JOB_LEASE_MS || '30000', 10)
const pollIntervalMs = Number.parseInt(process.env.EVALUATION_POLL_INTERVAL_MS || '2000', 10)

;(async () => {
  while (!controller.signal.aborted) {
    const result = await processOneEvaluationJob(store, {
      workerId,
      leaseMs,
    })

    if (!result.processed) {
      await delay(pollIntervalMs, undefined, { signal: controller.signal }).catch(() => undefined)
    }
  }
})().catch((error) => {
  logger.error('Evaluation worker crashed', {
    error: error instanceof Error ? error.message : String(error),
  })
  process.exitCode = 1
})
