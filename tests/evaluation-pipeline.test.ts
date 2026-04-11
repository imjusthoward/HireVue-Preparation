import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { EvaluationJobStatus, InterviewSessionStatus } from '@prisma/client'
import { scoreAnswerDeterministically } from '@/lib/evaluation/demo-scorer'
import { processOneEvaluationJob } from '@/lib/evaluation/service'
import type {
  ClaimedEvaluationJob,
  ClaimJobOptions,
  CompleteJobInput,
  EvaluationJobRecord,
  EvaluationStore,
  FailJobInput,
  SubmitAnswerInput,
  SubmitAnswerResult,
} from '@/lib/evaluation/types'

class FakeEvaluationStore implements EvaluationStore {
  submitResult: SubmitAnswerResult = {
    sessionId: 'session-1',
    answerId: 'answer-1',
    jobId: 'job-1',
    createdAnswer: true,
    reusedSubmission: false,
    status: InterviewSessionStatus.EVALUATING,
  }

  claimedJob: ClaimedEvaluationJob | null = null
  completed: CompleteJobInput[] = []
  failed: FailJobInput[] = []
  nextFailStatus: EvaluationJobStatus = EvaluationJobStatus.QUEUED
  nextAttemptCount = 1

  async submitAnswer(_input: SubmitAnswerInput): Promise<SubmitAnswerResult> {
    return this.submitResult
  }

  async claimNextJob(_options: ClaimJobOptions): Promise<ClaimedEvaluationJob | null> {
    return this.claimedJob
  }

  async completeJob(input: CompleteJobInput): Promise<void> {
    this.completed.push(input)
  }

  async failJob(input: FailJobInput): Promise<{ status: EvaluationJobStatus; attemptCount: number }> {
    this.failed.push(input)
    return {
      status: this.nextFailStatus,
      attemptCount: this.nextAttemptCount,
    }
  }

  async getJobByAnswerId(_answerId: string): Promise<EvaluationJobRecord | null> {
    return this.claimedJob?.job ?? null
  }
}

function makeClaimedJob(): ClaimedEvaluationJob {
  return {
    job: {
      id: 'job-1',
      answerId: 'answer-1',
      jobType: 'ANSWER_EVALUATION',
      status: 'IN_PROGRESS',
      attemptCount: 1,
      maxAttempts: 3,
      leaseExpiresAt: new Date('2026-04-11T00:00:30.000Z'),
      queuedAt: new Date('2026-04-11T00:00:00.000Z'),
      startedAt: new Date('2026-04-11T00:00:05.000Z'),
      completedAt: null,
      lastError: null,
      inputFingerprint: 'abc',
      provider: 'worker:test',
    },
    answer: {
      answerId: 'answer-1',
      sessionId: 'session-1',
      sessionQuestionId: 'sq-1',
      clientSubmissionId: 'submit-12345678',
      responseText:
        'I started by clarifying the problem, then segmented revenue and cost drivers, gathered customer feedback, and prioritized the highest-impact fixes. We improved retention by 12% over the next quarter.',
      prompt: 'How would you approach a profits decline case?',
      guidance: 'Use a structure and quantify impact.',
      rubricSnapshot: { dimensions: ['structure', 'evidence'] },
      sessionTitle: 'Demo Session',
      templateTitle: 'Consulting Case Interview Basics',
      templateCategory: 'CONSULTING',
    },
  }
}

describe('scoreAnswerDeterministically', () => {
  it('returns stable output for the same answer payload', () => {
    const claimed = makeClaimedJob()
    const first = scoreAnswerDeterministically(claimed.answer)
    const second = scoreAnswerDeterministically(claimed.answer)

    expect(first).toEqual(second)
    expect(first.provider).toBe('demo-deterministic')
    expect(first.overallScore).toBeGreaterThan(0)
  })
})

describe('processOneEvaluationJob', () => {
  const originalApiKey = process.env.OPENAI_API_KEY

  beforeEach(() => {
    process.env.OPENAI_API_KEY = ''
    vi.restoreAllMocks()
  })

  it('completes a claimed job and persists a feedback report', async () => {
    const store = new FakeEvaluationStore()
    store.claimedJob = makeClaimedJob()

    const result = await processOneEvaluationJob(store, {
      workerId: 'test-worker',
      now: new Date('2026-04-11T00:00:00.000Z'),
      leaseMs: 10_000,
    })

    expect(result.processed).toBe(true)
    expect(store.completed).toHaveLength(1)
    expect(store.failed).toHaveLength(0)
    expect(store.completed[0]?.report.provider).toBe('demo-deterministic')
    expect(store.completed[0]?.report.strengths.length).toBeGreaterThan(0)
  })

  it('requeues a failed job before max attempts', async () => {
    const store = new FakeEvaluationStore()
    store.claimedJob = makeClaimedJob()
    store.nextFailStatus = EvaluationJobStatus.QUEUED
    store.nextAttemptCount = 2

    const result = await processOneEvaluationJob(store, {
      workerId: 'test-worker',
      evaluate: async () => {
        throw new Error('transient failure')
      },
    })

    expect(result).toMatchObject({ processed: true, failed: true, status: EvaluationJobStatus.QUEUED, attemptCount: 2 })
    expect(store.failed).toHaveLength(1)
    expect(store.completed).toHaveLength(0)
  })

  it('marks a job as failed after max retries are exhausted', async () => {
    const store = new FakeEvaluationStore()
    store.claimedJob = makeClaimedJob()
    store.nextFailStatus = EvaluationJobStatus.FAILED
    store.nextAttemptCount = 3

    const result = await processOneEvaluationJob(store, {
      workerId: 'test-worker',
      evaluate: async () => {
        throw new Error('permanent failure')
      },
    })

    expect(result).toMatchObject({ processed: true, failed: true, status: EvaluationJobStatus.FAILED, attemptCount: 3 })
    expect(store.failed).toHaveLength(1)
  })

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalApiKey
  })
})
