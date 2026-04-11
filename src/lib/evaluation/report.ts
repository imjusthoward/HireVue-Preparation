import OpenAI from 'openai'
import { scoreAnswerDeterministically } from '@/lib/evaluation/demo-scorer'
import { logger } from '@/lib/logger'
import type { AnswerEvaluation, EvaluationAnswerContext, FeedbackReportPayload } from '@/lib/evaluation/types'

const MODEL = process.env.EVALUATION_MODEL || 'gpt-4.1-mini'

type LlmPayload = AnswerEvaluation

function buildPrompt(context: EvaluationAnswerContext) {
  return [
    'You are evaluating a mock interview answer for a HireVue-style preparation app.',
    'Return JSON only with keys: overallScore, recommendation, summary, rubricScores, strengths, improvementAreas, evaluatorVersion.',
    'Scoring scale is 0-100. Strengths and improvementAreas should each contain 2-3 concise strings.',
    `Template: ${context.templateTitle}`,
    `Category: ${context.templateCategory}`,
    `Prompt: ${context.prompt}`,
    `Guidance: ${context.guidance ?? 'None provided'}`,
    `Rubric snapshot: ${JSON.stringify(context.rubricSnapshot ?? {})}`,
    `Candidate answer: ${context.responseText}`,
  ].join('\n')
}

function normalizeLlmPayload(payload: LlmPayload): FeedbackReportPayload {
  return {
    overallScore: Math.max(0, Math.min(100, Math.round(payload.overallScore))),
    recommendation: payload.recommendation,
    summary: payload.summary,
    rubricScores: payload.rubricScores,
    strengths: payload.strengths,
    improvementAreas: payload.improvementAreas,
    evaluatorVersion: payload.evaluatorVersion,
    provider: 'openai',
  }
}

export async function generateFeedbackReport(context: EvaluationAnswerContext): Promise<FeedbackReportPayload> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return scoreAnswerDeterministically(context)
  }

  try {
    const client = new OpenAI({ apiKey })
    const response = await client.responses.create({
      model: MODEL,
      input: buildPrompt(context),
      text: {
        format: {
          type: 'json_schema',
          name: 'feedback_report',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['overallScore', 'recommendation', 'summary', 'rubricScores', 'strengths', 'improvementAreas', 'evaluatorVersion'],
            properties: {
              overallScore: { type: 'number' },
              recommendation: { type: 'string' },
              summary: { type: 'string' },
              rubricScores: {
                type: 'object',
                additionalProperties: { type: 'number' },
              },
              strengths: {
                type: 'array',
                items: { type: 'string' },
              },
              improvementAreas: {
                type: 'array',
                items: { type: 'string' },
              },
              evaluatorVersion: { type: 'string' },
            },
          },
        },
      },
    })

    const content = response.output_text
    if (!content) {
      throw new Error('OpenAI response did not include output_text')
    }

    return normalizeLlmPayload(JSON.parse(content) as LlmPayload)
  } catch (error) {
    logger.warn('Falling back to deterministic demo evaluator after model failure', {
      answerId: 'answerId' in context ? context.answerId : undefined,
      error: error instanceof Error ? error.message : String(error),
    })

    return scoreAnswerDeterministically(context)
  }
}
