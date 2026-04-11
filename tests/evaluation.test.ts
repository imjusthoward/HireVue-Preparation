import { afterEach, describe, expect, it } from 'vitest'
import {
  buildSessionFeedbackArtifact,
  evaluateAnswer,
  normalizeAnswerText,
  type SessionFeedbackQuestion,
} from '@/lib/evaluation/engine'

describe('evaluation engine', () => {
  const originalProvider = process.env.EVALUATION_PROVIDER

  afterEach(() => {
    process.env.EVALUATION_PROVIDER = originalProvider
  })

  it('normalizes whitespace without losing paragraph breaks', () => {
    const normalized = normalizeAnswerText('  First line.  \n\n   Second line.   ')
    expect(normalized).toBe('First line.\n\nSecond line.')
  })

  it('scores a structured answer higher than a vague answer', async () => {
    process.env.EVALUATION_PROVIDER = 'demo'

    const strongAnswer = await evaluateAnswer({
      templateTitle: 'Consulting',
      templateCategory: 'Consulting',
      questionPrompt: 'Tell me about a time you influenced without authority.',
      questionGuidance: 'Use a concrete example and explain the tradeoff.',
      answerText:
        'I led a cross-functional launch by aligning product, engineering, and sales around one metric. We delayed scope by one week, reduced rework by 30%, and shipped the version that customers actually needed because the extra clarity on the problem changed the decision.',
    })

    const weakAnswer = await evaluateAnswer({
      templateTitle: 'Consulting',
      templateCategory: 'Consulting',
      questionPrompt: 'Tell me about a time you influenced without authority.',
      questionGuidance: 'Use a concrete example and explain the tradeoff.',
      answerText: 'I worked hard, communicated well, and got the job done.',
    })

    expect(strongAnswer.overallScore).toBeGreaterThan(weakAnswer.overallScore)
    expect(strongAnswer.recommendation === 'yes' || strongAnswer.recommendation === 'strong_yes').toBe(true)
    expect(weakAnswer.recommendation === 'borderline' || weakAnswer.recommendation === 'no').toBe(true)
  })

  it('aggregates question feedback into a session report', async () => {
    process.env.EVALUATION_PROVIDER = 'demo'

    const first = await evaluateAnswer({
      templateTitle: 'Product Management',
      templateCategory: 'Product',
      questionPrompt: 'How would you prioritize a roadmap?',
      answerText:
        'I would rank the work by customer impact, effort, and strategic value. If a feature moves the key metric by 10% and supports the next quarter goal, it goes first. I also check risk and the minimum viable outcome before committing.',
    })

    const second = await evaluateAnswer({
      templateTitle: 'Product Management',
      templateCategory: 'Product',
      questionPrompt: 'How do you handle disagreement with stakeholders?',
      answerText:
        'I start by restating the shared goal, then I explain the tradeoff, show the data, and propose a small test. That keeps the conversation factual and usually gets us to the right decision without turning it into a fight.',
    })

    const feedback = buildSessionFeedbackArtifact({
      sessionTitle: 'Product mock interview',
      templateTitle: 'Product Management',
      questions: [
        {
          questionId: 'question-2',
          orderIndex: 2,
          prompt: 'How do you handle disagreement with stakeholders?',
          guidance: null,
          answerText:
            'I start by restating the shared goal, then I explain the tradeoff, show the data, and propose a small test. That keeps the conversation factual and usually gets us to the right decision without turning it into a fight.',
          report: second,
        } satisfies SessionFeedbackQuestion,
        {
          questionId: 'question-1',
          orderIndex: 1,
          prompt: 'How would you prioritize a roadmap?',
          guidance: null,
          answerText:
            'I would rank the work by customer impact, effort, and strategic value. If a feature moves the key metric by 10% and supports the next quarter goal, it goes first. I also check risk and the minimum viable outcome before committing.',
          report: first,
        } satisfies SessionFeedbackQuestion,
      ],
    })

    expect(feedback.questionFeedback[0].orderIndex).toBe(1)
    expect(feedback.overallScore).toBeGreaterThan(0)
    expect(feedback.strengths.length).toBeGreaterThan(0)
    expect(feedback.improvementAreas.length).toBeGreaterThan(0)
    expect(feedback.summary).toContain('Product mock interview')
  })
})
