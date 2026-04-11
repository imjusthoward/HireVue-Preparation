import { scoreAnswerFallback, type AnswerEvaluation } from '@/lib/evaluation/engine'
import type { EvaluationAnswerRecord } from '@/lib/evaluation/types'

export function scoreAnswerDeterministically(answer: EvaluationAnswerRecord): AnswerEvaluation {
  const report = scoreAnswerFallback({
    templateTitle: answer.templateTitle,
    templateCategory: answer.templateCategory,
    questionPrompt: answer.prompt,
    questionGuidance: answer.guidance,
    answerText: answer.responseText,
    rubricSnapshot: answer.rubricSnapshot,
  })

  return {
    ...report,
    provider: 'demo-deterministic',
  }
}
