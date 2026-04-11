import { Prisma, UserRole } from '@prisma/client'
import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth/password'

type TemplateSeed = {
  slug: string
  title: string
  description: string
  category: string
  questions: Array<{
    orderIndex: number
    prompt: string
    guidance: string
    rubricDefinition: Prisma.InputJsonObject
  }>
}

const templates: TemplateSeed[] = [
  {
    slug: 'consulting-case-basics',
    title: 'Consulting Case Interview Basics',
    description: 'Structured business problem solving with hypothesis-driven answers.',
    category: 'CONSULTING',
    questions: [
      {
        orderIndex: 1,
        prompt: 'A regional coffee chain has seen profits drop by 15% over the last two quarters. How would you approach the case?',
        guidance: 'Use a clear issue tree, separate revenue vs. cost drivers, and explain what data you would request first.',
        rubricDefinition: { dimensions: ['structure', 'analysis', 'prioritization', 'communication'] },
      },
      {
        orderIndex: 2,
        prompt: 'How would you estimate the annual market size for electric scooters in Tokyo?',
        guidance: 'State assumptions explicitly, use a top-down or bottom-up approach, and sanity-check the result.',
        rubricDefinition: { dimensions: ['assumptions', 'math', 'sanity_check', 'communication'] },
      },
      {
        orderIndex: 3,
        prompt: 'Tell me about a time you influenced stakeholders without direct authority.',
        guidance: 'Use a concise STAR structure and quantify the business outcome.',
        rubricDefinition: { dimensions: ['leadership', 'stakeholder_management', 'impact', 'reflection'] },
      },
    ],
  },
  {
    slug: 'finance-core',
    title: 'Finance and Valuation Core',
    description: 'Accounting fluency, valuation judgment, and investment communication.',
    category: 'FINANCE',
    questions: [
      {
        orderIndex: 1,
        prompt: 'Walk me through how the three financial statements link together when depreciation increases by $10.',
        guidance: 'Cover income statement, cash flow statement, and balance sheet in order.',
        rubricDefinition: { dimensions: ['technical_accuracy', 'flow', 'completeness', 'clarity'] },
      },
      {
        orderIndex: 2,
        prompt: 'How would you value a mature industrial company?',
        guidance: 'Discuss at least two valuation methods and when you would trust one more than the other.',
        rubricDefinition: { dimensions: ['valuation_framework', 'judgment', 'comparables', 'communication'] },
      },
      {
        orderIndex: 3,
        prompt: 'Pitch me a stock in two minutes.',
        guidance: 'Lead with thesis, catalyst, risks, and expected upside/downside.',
        rubricDefinition: { dimensions: ['thesis', 'catalyst', 'risk_management', 'conviction'] },
      },
    ],
  },
  {
    slug: 'product-sense-and-execution',
    title: 'Product Sense and Execution',
    description: 'Product strategy, metrics, prioritization, and user-centered trade-offs.',
    category: 'PRODUCT',
    questions: [
      {
        orderIndex: 1,
        prompt: 'How would you improve the onboarding experience for a mobile budgeting app?',
        guidance: 'Define the user, current friction, success metrics, and the first experiment you would run.',
        rubricDefinition: { dimensions: ['user_empathy', 'prioritization', 'metrics', 'experimentation'] },
      },
      {
        orderIndex: 2,
        prompt: 'A key engagement metric dropped 12% after a redesign. What would you do next?',
        guidance: 'Separate diagnosis from solutioning and be explicit about trade-offs and instrumentation.',
        rubricDefinition: { dimensions: ['debugging', 'analytics', 'trade_offs', 'decision_making'] },
      },
      {
        orderIndex: 3,
        prompt: 'Tell me about a product decision you made with incomplete information.',
        guidance: 'Describe the context, decision, risks, and what you learned after launch.',
        rubricDefinition: { dimensions: ['judgment', 'risk', 'ownership', 'learning'] },
      },
    ],
  },
  {
    slug: 'behavioral-story-bank',
    title: 'Behavioral Story Bank',
    description: 'General behavioral prompts that reward clear ownership and reflection.',
    category: 'BEHAVIORAL',
    questions: [
      {
        orderIndex: 1,
        prompt: 'Tell me about a time you failed.',
        guidance: 'Focus on ownership, what changed afterward, and what you would do differently now.',
        rubricDefinition: { dimensions: ['ownership', 'reflection', 'growth', 'communication'] },
      },
      {
        orderIndex: 2,
        prompt: 'Describe a conflict with a teammate and how you resolved it.',
        guidance: 'Keep the story balanced, avoid villainizing the other person, and show concrete resolution steps.',
        rubricDefinition: { dimensions: ['self_awareness', 'collaboration', 'resolution', 'maturity'] },
      },
      {
        orderIndex: 3,
        prompt: 'What is a decision you are proud of and why?',
        guidance: 'Explain the stakes, your reasoning process, and the measurable result.',
        rubricDefinition: { dimensions: ['decision_quality', 'impact', 'clarity', 'authenticity'] },
      },
    ],
  },
]

type DemoAccountSeed = {
  email: string
  password: string
  name: string
  role: UserRole
}

const demoAccounts: DemoAccountSeed[] = [
  {
    email: process.env.DEMO_ADMIN_EMAIL?.trim() || 'admin@prep.local',
    password: process.env.DEMO_ADMIN_PASSWORD?.trim() || 'admin1234',
    name: 'Demo Admin',
    role: UserRole.ADMIN,
  },
  {
    email: process.env.DEMO_USER_EMAIL?.trim() || 'demo@prep.local',
    password: process.env.DEMO_USER_PASSWORD?.trim() || 'demo1234',
    name: 'Demo User',
    role: UserRole.USER,
  },
]

async function seedTemplates() {
  for (const template of templates) {
    await db.interviewTemplate.upsert({
      where: { slug: template.slug },
      update: {
        title: template.title,
        description: template.description,
        category: template.category,
        isActive: true,
      },
      create: {
        slug: template.slug,
        title: template.title,
        description: template.description,
        category: template.category,
        isActive: true,
      },
    })

    const savedTemplate = await db.interviewTemplate.findUniqueOrThrow({
      where: { slug: template.slug },
    })

    for (const question of template.questions) {
      await db.question.upsert({
        where: {
          templateId_orderIndex: {
            templateId: savedTemplate.id,
            orderIndex: question.orderIndex,
          },
        },
        update: {
          prompt: question.prompt,
          guidance: question.guidance,
          rubricDefinition: question.rubricDefinition,
        },
        create: {
          templateId: savedTemplate.id,
          orderIndex: question.orderIndex,
          prompt: question.prompt,
          guidance: question.guidance,
          rubricDefinition: question.rubricDefinition,
        },
      })
    }
  }
}

async function seedDemoAccounts() {
  for (const account of demoAccounts) {
    const passwordHash = await hashPassword(account.password)

    await db.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        passwordHash,
        role: account.role,
        isActive: true,
      },
      create: {
        email: account.email,
        name: account.name,
        passwordHash,
        role: account.role,
        isActive: true,
      },
    })
  }
}

async function main() {
  await seedDemoAccounts()
  await seedTemplates()
  console.info(
    `Seeded ${demoAccounts.length} demo users and ${templates.length} interview templates`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
