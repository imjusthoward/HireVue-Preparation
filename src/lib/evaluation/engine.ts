import OpenAI from 'openai'
import { z } from 'zod'
import { logger } from '@/lib/logger'

export const EVALUATOR_VERSION = 'demo-rubric-v1'

const recommendationSchema = z.enum(['strong_yes', 'yes', 'borderline', 'no'])
const rubricScoresSchema = z
  .object({
    clarity: z.number().int().min(1).max(5),
    structure: z.number().int().min(1).max(5),
    specificity: z.number().int().min(1).max(5),
    businessJudgment: z.number().int().min(1).max(5),
    communication: z.number().int().min(1).max(5),
  })
  .strict()

const answerEvaluationSchema = z
  .object({
    overallScore: z.number().int().min(0).max(100),
    recommendation: recommendationSchema,
    summary: z.string().min(1).max(4000),
    rubricScores: rubricScoresSchema,
    strengths: z.array(z.string().min(1).max(240)).min(1),
    improvementAreas: z.array(z.string().min(1).max(240)).min(1),
  })
  .strict()

export type Recommendation = z.infer<typeof recommendationSchema>
export type RubricScores = z.infer<typeof rubricScoresSchema>
export type AnswerEvaluation = z.infer<typeof answerEvaluationSchema> & {
  provider: 'demo' | 'demo-deterministic' | 'openai'
  evaluatorVersion: string
}

export type InterviewEvaluationContext = {
  templateTitle: string
  templateCategory: string
  questionPrompt: string
  questionGuidance?: string | null
  answerText: string
  rubricSnapshot?: unknown
}

export type SessionFeedbackQuestion = {
  questionId: string
  orderIndex: number
  prompt: string
  guidance: string | null
  answerText: string
  report: AnswerEvaluation
}

export type SessionFeedbackArtifact = {
  overallScore: number
  recommendation: Recommendation
  summary: string
  rubricScores: RubricScores
  strengths: string[]
  improvementAreas: string[]
  questionFeedback: SessionFeedbackQuestion[]
}

const openAiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ')
}

export function normalizeAnswerText(value: string) {
  return normalizeWhitespace(value)
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function countWords(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  return words.length
}

function clampScore(value: number) {
  return Math.min(5, Math.max(1, Math.round(value)))
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function hasAny(value: string, patterns: string[]) {
  const lowerValue = value.toLowerCase()
  return patterns.some((pattern) => lowerValue.includes(pattern))
}

function scoreClarity(answer: string) {
  const sentences = answer
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  const avgSentenceLength = sentences.length > 0 ? countWords(answer) / sentences.length : countWords(answer)

  if (avgSentenceLength <= 18) {
    return 5
  }

  if (avgSentenceLength <= 24) {
    return 4
  }

  if (avgSentenceLength <= 32) {
    return 3
  }

  if (avgSentenceLength <= 42) {
    return 2
  }

  return 1
}

function scoreStructure(answer: string) {
  const hasBullets = /(^|\n)\s*[-*•]\s+/m.test(answer)
  const hasNumbering = /(^|\n)\s*\d+\.\s+/m.test(answer)
  const paragraphCount = answer.split(/\n\s*\n/).filter((block) => block.trim()).length
  const sentenceCount = answer.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean).length
  const transitionSignals = hasAny(answer, ['first', 'then', 'next', 'finally', 'overall', 'because', 'so that'])
  const score =
    (hasBullets ? 1 : 0) +
    (hasNumbering ? 1 : 0) +
    (paragraphCount >= 2 ? 1 : 0) +
    (sentenceCount >= 2 ? 1 : 0) +
    (transitionSignals ? 1 : 0)

  return clampScore(score || 1)
}

function scoreSpecificity(answer: string) {
  const signals = [
    /\b\d+%/.test(answer),
    /\b\d+x\b/.test(answer),
    /\b\d+\b/.test(answer),
    hasAny(answer, ['for example', 'specifically', 'in practice', 'because', 'result', 'impact', 'measured']),
    hasAny(answer, ['team', 'customer', 'stakeholder', 'metric', 'deadline', 'tradeoff']),
  ].filter(Boolean).length

  return clampScore(signals)
}

function scoreBusinessJudgment(answer: string) {
  const signals = [
    'tradeoff',
    'risk',
    'priority',
    'stakeholder',
    'customer',
    'budget',
    'revenue',
    'quality',
    'scope',
    'timeline',
    'constraint',
    'decision',
    'context',
  ]

  const matchedSignals = signals.filter((signal) => answer.toLowerCase().includes(signal)).length

  if (matchedSignals === 0) {
    return 1
  }

  return clampScore(matchedSignals + 1)
}

function scoreCommunication(answer: string) {
  const wordCount = countWords(answer)
  const paragraphCount = answer.split(/\n\s*\n/).filter((block) => block.trim()).length

  if (wordCount < 40) {
    return paragraphCount === 0 ? 2 : 3
  }

  if (wordCount <= 180) {
    return paragraphCount >= 2 ? 5 : 4
  }

  if (wordCount <= 260) {
    return paragraphCount >= 3 ? 4 : 3
  }

  return paragraphCount >= 3 ? 3 : 2
}

function deriveRecommendation(overallScore: number): Recommendation {
  if (overallScore >= 85) {
    return 'strong_yes'
  }

  if (overallScore >= 72) {
    return 'yes'
  }

  if (overallScore >= 58) {
    return 'borderline'
  }

  return 'no'
}

function buildStrengths(answer: string, rubricScores: RubricScores) {
  const strengths: string[] = []

  if (rubricScores.structure >= 4) {
    strengths.push('You used a clear structure that was easy to follow.')
  }

  if (rubricScores.specificity >= 4) {
    strengths.push('You grounded the answer in specific details instead of staying abstract.')
  }

  if (rubricScores.businessJudgment >= 4) {
    strengths.push('You showed judgment by explaining tradeoffs and priorities.')
  }

  if (rubricScores.clarity >= 4) {
    strengths.push('The answer reads clearly and is easy to listen to in an interview.')
  }

  if (countWords(answer) >= 90) {
    strengths.push('There is enough substance here to evaluate the example seriously.')
  }

  return strengths.length > 0 ? strengths : ['The answer is concise and can be tightened into a more interview-ready story.']
}

function buildImprovementAreas(answer: string, rubricScores: RubricScores) {
  const improvements: string[] = []

  if (rubricScores.specificity <= 3) {
    improvements.push('Add one concrete example with a metric, result, or observable outcome.')
  }

  if (rubricScores.structure <= 3) {
    improvements.push('Use a tighter opening, middle, and close so the answer feels easier to follow.')
  }

  if (rubricScores.businessJudgment <= 3) {
    improvements.push('Explain the tradeoff you considered and why you chose that path.')
  }

  if (rubricScores.clarity <= 3) {
    improvements.push('Shorten long sentences so the answer lands more cleanly in conversation.')
  }

  if (countWords(answer) < 70) {
    improvements.push('Expand the answer so it shows process, judgment, and one concrete detail.')
  }

  return improvements.length > 0 ? improvements : ['The answer already covers the basics; the next step is to make it sharper and more memorable.']
}

function buildSummary(context: InterviewEvaluationContext, rubricScores: RubricScores, overallScore: number) {
  const strongestCategory = Object.entries(rubricScores).sort((a, b) => b[1] - a[1])[0]
  const weakestCategory = Object.entries(rubricScores).sort((a, b) => a[1] - b[1])[0]

  return [
    `For the ${context.templateCategory.toLowerCase()} prompt "${context.questionPrompt.slice(0, 120)}", this answer scored ${overallScore}/100.`,
    `The strongest signal was ${strongestCategory[0]} at ${strongestCategory[1]}/5.`,
    `The area to tighten is ${weakestCategory[0]} at ${weakestCategory[1]}/5.`,
  ].join(' ')
}

export function scoreAnswerFallback(context: InterviewEvaluationContext): AnswerEvaluation {
  const answer = normalizeAnswerText(context.answerText)
  const rubricScores: RubricScores = {
    clarity: scoreClarity(answer),
    structure: scoreStructure(answer),
    specificity: scoreSpecificity(answer),
    businessJudgment: scoreBusinessJudgment(answer),
    communication: scoreCommunication(answer),
  }

  const weightedAverage =
    rubricScores.clarity * 0.2 +
    rubricScores.structure * 0.2 +
    rubricScores.specificity * 0.25 +
    rubricScores.businessJudgment * 0.2 +
    rubricScores.communication * 0.15

  const overallScore = Math.round((weightedAverage / 5) * 100)

  return {
    overallScore,
    recommendation: deriveRecommendation(overallScore),
    summary: buildSummary(context, rubricScores, overallScore),
    rubricScores,
    strengths: buildStrengths(answer, rubricScores),
    improvementAreas: buildImprovementAreas(answer, rubricScores),
    provider: 'demo',
    evaluatorVersion: EVALUATOR_VERSION,
  }
}

const openAiEvaluationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overallScore: { type: 'integer', minimum: 0, maximum: 100 },
    recommendation: {
      type: 'string',
      enum: ['strong_yes', 'yes', 'borderline', 'no'],
    },
    summary: { type: 'string', minLength: 1 },
    rubricScores: {
      type: 'object',
      additionalProperties: false,
      properties: {
        clarity: { type: 'integer', minimum: 1, maximum: 5 },
        structure: { type: 'integer', minimum: 1, maximum: 5 },
        specificity: { type: 'integer', minimum: 1, maximum: 5 },
        businessJudgment: { type: 'integer', minimum: 1, maximum: 5 },
        communication: { type: 'integer', minimum: 1, maximum: 5 },
      },
      required: ['clarity', 'structure', 'specificity', 'businessJudgment', 'communication'],
    },
    strengths: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 1,
    },
    improvementAreas: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 1,
    },
  },
  required: ['overallScore', 'recommendation', 'summary', 'rubricScores', 'strengths', 'improvementAreas'],
} as const

function buildOpenAiPrompt(context: InterviewEvaluationContext) {
  const rubricInstructions = context.rubricSnapshot
    ? `Rubric snapshot: ${JSON.stringify(context.rubricSnapshot)}`
    : 'Rubric snapshot: not provided.'

  return [
    'You are scoring a HireVue style mock interview answer.',
    'Return strict JSON that matches the provided schema.',
    'Write like a coach or recruiter, not like a chatbot.',
    'Score the answer across clarity, structure, specificity, business judgment, and communication.',
    rubricInstructions,
    `Template: ${context.templateTitle} (${context.templateCategory})`,
    `Question: ${context.questionPrompt}`,
    context.questionGuidance ? `Guidance: ${context.questionGuidance}` : 'Guidance: none',
    `Answer: ${context.answerText}`,
  ].join('\n\n')
}

function parseOpenAiResult(rawValue: unknown, fallbackContext: InterviewEvaluationContext) {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return scoreAnswerFallback(fallbackContext)
  }

  try {
    const parsed = answerEvaluationSchema.parse(JSON.parse(rawValue))
    return {
      ...parsed,
      provider: 'openai' as const,
      evaluatorVersion: EVALUATOR_VERSION,
    }
  } catch (error) {
    logger.warn('openai_evaluation_parse_failed', {
      error: error instanceof Error ? error.message : 'unknown',
    })
    return scoreAnswerFallback(fallbackContext)
  }
}

async function evaluateWithOpenAi(context: InterviewEvaluationContext) {
  if (!openAiClient) {
    return scoreAnswerFallback(context)
  }

  try {
    const response = await openAiClient.responses.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
      input: buildOpenAiPrompt(context),
      text: {
        format: {
          type: 'json_schema',
          name: 'interview_evaluation',
          schema: openAiEvaluationSchema,
          strict: true,
        },
        verbosity: 'low',
      },
    })

    return parseOpenAiResult(response.output_text, context)
  } catch (error) {
    logger.warn('openai_evaluation_failed', {
      error: error instanceof Error ? error.message : 'unknown',
    })
    return scoreAnswerFallback(context)
  }
}

export async function evaluateAnswer(context: InterviewEvaluationContext) {
  if (process.env.EVALUATION_PROVIDER === 'openai') {
    return evaluateWithOpenAi(context)
  }

  return scoreAnswerFallback(context)
}

export function buildSessionFeedbackArtifact(input: {
  sessionTitle: string | null
  templateTitle: string
  questions: SessionFeedbackQuestion[]
}): SessionFeedbackArtifact {
  const questionFeedback = input.questions
    .slice()
    .sort((left, right) => left.orderIndex - right.orderIndex)

  const overallScore = questionFeedback.length
    ? Math.round(average(questionFeedback.map((entry) => entry.report.overallScore)))
    : 0

  const rubricScores: RubricScores = {
    clarity: Math.round(average(questionFeedback.map((entry) => entry.report.rubricScores.clarity))) || 0,
    structure: Math.round(average(questionFeedback.map((entry) => entry.report.rubricScores.structure))) || 0,
    specificity: Math.round(average(questionFeedback.map((entry) => entry.report.rubricScores.specificity))) || 0,
    businessJudgment:
      Math.round(average(questionFeedback.map((entry) => entry.report.rubricScores.businessJudgment))) || 0,
    communication: Math.round(average(questionFeedback.map((entry) => entry.report.rubricScores.communication))) || 0,
  }

  const strengths = dedupe(questionFeedback.flatMap((entry) => entry.report.strengths))
  const improvementAreas = dedupe(questionFeedback.flatMap((entry) => entry.report.improvementAreas))
  const recommendation = deriveRecommendation(overallScore)

  const summaryParts = [
    input.sessionTitle ? `Session "${input.sessionTitle}"` : `Session "${input.templateTitle}"`,
    `finished with an overall score of ${overallScore}/100.`,
    `The strongest average signals were ${Object.entries(rubricScores)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => `${key} ${value}/5`)
      .slice(0, 2)
      .join(' and ')}.`,
    `The most consistent coaching theme was ${improvementAreas[0] ?? 'tightening the narrative and adding one concrete example'}.`,
  ]

  return {
    overallScore,
    recommendation,
    summary: summaryParts.join(' '),
    rubricScores,
    strengths,
    improvementAreas,
    questionFeedback,
  }
}
