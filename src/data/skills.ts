import type { Skill } from '@/types'

export type SkillCatalog = Omit<Skill, 'id'> & { id: string }

export const skillCatalog: SkillCatalog[] = [
  { id: 'cat-ts', name: 'TypeScript', category: 'technical', proficiency: 5 },
  { id: 'cat-react', name: 'React', category: 'technical', proficiency: 5 },
  { id: 'cat-next', name: 'Next.js', category: 'technical', proficiency: 4 },
  { id: 'cat-node', name: 'Node.js', category: 'technical', proficiency: 4 },
  { id: 'cat-graphql', name: 'GraphQL', category: 'technical', proficiency: 4 },
  { id: 'cat-vue', name: 'Vue', category: 'technical', proficiency: 2 },
  { id: 'cat-python', name: 'Python', category: 'technical', proficiency: 2 },
  { id: 'cat-ml', name: 'Machine Learning', category: 'technical', proficiency: 1 },
  { id: 'cat-rays', name: 'PyTorch', category: 'technical', proficiency: 1 },
  { id: 'cat-prompty', name: 'Prompt Engineering', category: 'technical', proficiency: 2 },
  { id: 'cat-llm', name: 'LLM Integration (Vercel AI SDK)', category: 'technical', proficiency: 3 },
  { id: 'cat-vector', name: 'Vector Databases', category: 'technical', proficiency: 1 },
  { id: 'cat-system-design', name: 'System Design', category: 'technical', proficiency: 3 },
  { id: 'cat-testing', name: 'Test-Driven Development', category: 'technical', proficiency: 4 },
  { id: 'cat-docker', name: 'Docker & Kubernetes', category: 'tool', proficiency: 3 },
  { id: 'cat-metrics', name: 'A/B Testing & Metrics', category: 'tool', proficiency: 3 },
  { id: 'cat-design', name: 'Design Systems', category: 'technical', proficiency: 5 },
  { id: 'cat-leadership', name: 'Technical Leadership', category: 'soft', proficiency: 4 },
  { id: 'cat-mentorship', name: 'Mentorship', category: 'soft', proficiency: 5 },
  { id: 'cat-stakeholder', name: 'Stakeholder Communication', category: 'soft', proficiency: 4 },
  { id: 'cat-product', name: 'Product Thinking', category: 'soft', proficiency: 4 },
]

export const skillGroups: { label: string; description: string }[] = [
  { label: 'Technical', description: 'Languages, frameworks, and engineering practice' },
  { label: 'Soft', description: 'Leadership, communication, and ways of working' },
  { label: 'Tools', description: 'Platforms and emerging AI tooling' },
]

export const skillCategories: Skill['category'][] = ['technical', 'soft', 'tool']