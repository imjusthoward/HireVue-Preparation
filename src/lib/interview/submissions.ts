import { createHash } from 'node:crypto'
import {
  EvaluationJobStatus,
  EvaluationJobType,
  InterviewSessionStatus,
} from '@prisma/client'
import { db } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit'
import { normalizeAnswerText } from '@/lib/evaluation/engine'
import { RouteError } from '@/lib/session'

export async function submitInterviewAnswer(input: {
  userId: string
  sessionQuestionId: string
  clientSubmissionId: string
  responseText: string
  request?: Request
}) {
  const existingAnswer = await db.answer.findUnique({
    where: {
      clientSubmissionId: input.clientSubmissionId,
    },
    include: {
      sessionQuestion: {
        include: {
          session: true,
        },
      },
      evaluationJobs: true,
    },
  })

  if (existingAnswer) {
    if (existingAnswer.sessionQuestionId !== input.sessionQuestionId) {
      throw new RouteError(409, 'Submission id already belongs to another answer')
    }

    return {
      sessionId: existingAnswer.sessionQuestion.session.id,
      answerId: existingAnswer.id,
      jobId: existingAnswer.evaluationJobs[0]?.id ?? null,
      createdAnswer: false,
      reusedSubmission: true,
      status: InterviewSessionStatus.EVALUATING,
    }
  }

  const sessionQuestion = await db.sessionQuestion.findUnique({
    where: {
      id: input.sessionQuestionId,
    },
    include: {
      session: {
        include: {
          template: true,
        },
      },
      question: true,
      answer: true,
    },
  })

  if (!sessionQuestion || sessionQuestion.session.userId !== input.userId) {
    throw new RouteError(404, 'Interview session question not found')
  }

  if (
    sessionQuestion.session.status === InterviewSessionStatus.COMPLETED ||
    sessionQuestion.session.status === InterviewSessionStatus.CANCELLED ||
    sessionQuestion.session.status === InterviewSessionStatus.FAILED
  ) {
    throw new RouteError(409, 'Interview session is no longer accepting answers')
  }

  if (sessionQuestion.answer) {
    throw new RouteError(409, 'This question already has an answer')
  }

  const normalizedResponse = normalizeAnswerText(input.responseText)

  if (!normalizedResponse) {
    throw new RouteError(400, 'Answer cannot be empty')
  }

  const createdAnswer = await db.answer.create({
    data: {
      sessionQuestionId: sessionQuestion.id,
      clientSubmissionId: input.clientSubmissionId,
      responseText: normalizedResponse,
    },
  })

  const createdJob = await db.evaluationJob.create({
    data: {
      answerId: createdAnswer.id,
      jobType: EvaluationJobType.ANSWER_EVALUATION,
      status: EvaluationJobStatus.QUEUED,
      inputFingerprint: createHash('sha256')
        .update([createdAnswer.sessionQuestionId, createdAnswer.clientSubmissionId, normalizedResponse].join(':'))
        .digest('hex'),
      provider: process.env.EVALUATION_PROVIDER ?? 'demo',
    },
  })

  await db.interviewSession.update({
    where: {
      id: sessionQuestion.session.id,
    },
    data: {
      status: InterviewSessionStatus.EVALUATING,
      lastActivityAt: new Date(),
    },
  })

  await writeAuditLog({
    action: 'ANSWER_SUBMITTED',
    targetType: 'Answer',
    targetId: createdAnswer.id,
    actorUserId: input.userId,
    metadata: {
      sessionId: sessionQuestion.session.id,
      sessionQuestionId: sessionQuestion.id,
    },
    request: input.request,
  })

  return {
    sessionId: sessionQuestion.session.id,
    answerId: createdAnswer.id,
    jobId: createdJob.id,
    createdAnswer: true,
    reusedSubmission: false,
    status: InterviewSessionStatus.EVALUATING,
  }
}
