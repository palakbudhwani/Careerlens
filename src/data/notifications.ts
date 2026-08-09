import type { NotificationItem } from '@/types'

export const notifications: NotificationItem[] = [
  {
    id: 'ntf-001',
    kind: 'match',
    title: 'New match ready',
    description: 'Senior Frontend Engineer @ Nimbus AI scored 92% — your strongest match yet.',
    createdAt: '2026-08-08T08:12:00Z',
    unread: true,
  },
  {
    id: 'ntf-002',
    kind: 'gap',
    title: 'Critical gap identified',
    description: 'LLM Integration is now flagged as critical for 2 target roles.',
    createdAt: '2026-08-08T09:02:00Z',
    unread: true,
  },
  {
    id: 'ntf-003',
    kind: 'system',
    title: 'Resume refreshed',
    description: 'Completeness is at 88%. Adding a projects section would raise it to 94%.',
    createdAt: '2026-08-08T08:20:00Z',
    unread: false,
  },
]