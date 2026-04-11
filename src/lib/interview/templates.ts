import { db } from '@/lib/db'
import { buildTemplateCard } from '@/lib/interview/shared'

export async function listInterviewTemplates() {
  const templates = await db.interviewTemplate.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      title: 'asc',
    },
    include: {
      questions: {
        orderBy: {
          orderIndex: 'asc',
        },
      },
    },
  })

  return templates.map((template) => buildTemplateCard(template))
}
