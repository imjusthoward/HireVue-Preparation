import { EvaluationJobStatus } from '@prisma/client'
import { scoreAnswerDeterministically } from '@/lib/evaluation/demo-scorer'
import type {
  EvaluationStore,
  ProcessJobOptions,
  ProcessJobResult,
} from '@/lib/evaluation/types'

export async function processOneEvaluationJob(
  store: EvaluationStore,
  options: ProcessJobOptions,
): Promise<ProcessJobResult> {
  const now = options.now ?? new Date()
  const leaseMs = options.leaseMs ?? 120_000
  const claimed = await store.claimNextJob({
    workerId: options.workerId,
    now,
    leaseMs,
  })

  if (!claimed) {
    return {
      processed: false,
      reason: 'empty_queue',
    }
  }

  const evaluate = options.evaluate ?? scoreAnswerDeterministically

  try {
    const report = await evaluate(claimed.answer)
    await store.completeJob({
      job: claimed.job,
      answer: claimed.answer,
      report,
      now,
    })

    return {
      processed: true,
      failed: false,
      status: 'SUCCEEDED',
      job: claimed.job,
      report,
    }
  } catch (error) {
    const { status, attemptCount } = await store.failJob({
      job: claimed.job,
      error: error instanceof Error ? error : new Error('Unknown evaluation failure'),
      now,
    })

    return {
      processed: true,
      failed: true,
      status: status ?? EvaluationJobStatus.FAILED,
      attemptCount,
      job: claimed.job,
    }
  }
}
