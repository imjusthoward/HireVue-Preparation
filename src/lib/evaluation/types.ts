import type {
  EvaluationJobStatus,
  EvaluationJobType,
  InterviewSessionStatus,
} from '@prisma/client'
import type {
  AnswerEvaluation as EngineAnswerEvaluation,
  InterviewEvaluationContext as EngineInterviewEvaluationContext,
} from '@/lib/evaluation/engine'

export type InterviewEvaluationContext = EngineInterviewEvaluationContext
export type AnswerEvaluation = EngineAnswerEvaluation
export type FeedbackReportPayload = AnswerEvaluation

export type EvaluationAnswerContext = {
  answerId: string
  sessionId: string
  sessionQuestionId: string
  clientSubmissionId: string
  sessionTitle: string | null
  templateTitle: string
  templateCategory: string
  prompt: string
  guidance: string | null
  responseText: string
  rubricSnapshot: unknown
}

export type EvaluationJobRecord = {
  id: string
  answerId: string
  jobType: EvaluationJobType | 'ANSWER_EVALUATION'
  status: EvaluationJobStatus
  attemptCount: number
  maxAttempts: number
  leaseExpiresAt: Date | null
  queuedAt: Date
  startedAt: Date | null
  completedAt: Date | null
  lastError: string | null
  inputFingerprint: string | null
  provider: string | null
}

export type EvaluationAnswerRecord = EvaluationAnswerContext

export type ClaimedEvaluationJob = {
  job: EvaluationJobRecord
  answer: EvaluationAnswerRecord
}

export type SubmitAnswerInput = {
  userId: string
  sessionQuestionId: string
  clientSubmissionId: string
  responseText: string
}

export type SubmitAnswerResult = {
  sessionId: string
  answerId: string
  jobId: string
  createdAnswer: boolean
  reusedSubmission: boolean
  status: InterviewSessionStatus
}

export type ClaimJobOptions = {
  workerId: string
  now?: Date
  leaseMs?: number
}

export type CompleteJobInput = {
  job: EvaluationJobRecord
  answer: EvaluationAnswerRecord
  report: AnswerEvaluation
  now?: Date
}

export type FailJobInput = {
  job: EvaluationJobRecord
  error: Error
  now?: Date
}

export type EvaluationStore = {
  submitAnswer(input: SubmitAnswerInput): Promise<SubmitAnswerResult>
  claimNextJob(options: ClaimJobOptions): Promise<ClaimedEvaluationJob | null>
  completeJob(input: CompleteJobInput): Promise<void>
  failJob(input: FailJobInput): Promise<{ status: EvaluationJobStatus; attemptCount: number }>
  getJobByAnswerId(answerId: string): Promise<EvaluationJobRecord | null>
}

export type ProcessJobOptions = {
  workerId: string
  now?: Date
  leaseMs?: number
  evaluate?: (answer: EvaluationAnswerRecord) => Promise<AnswerEvaluation> | AnswerEvaluation
}

export type ProcessJobResult =
  | {
      processed: false
      reason: 'empty_queue'
    }
  | {
      processed: true
      failed: false
      status: 'SUCCEEDED'
      job: EvaluationJobRecord
      report: AnswerEvaluation
    }
  | {
      processed: true
      failed: true
      status: EvaluationJobStatus
      attemptCount: number
      job: EvaluationJobRecord
    }
