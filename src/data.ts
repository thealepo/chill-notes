import type { Note } from './types'

export const starterNotes: Note[] = [
  {
    id: 'welcome-note',
    title: '',
    updatedAt: Date.now(),
    favorite: false,
    blocks: [{ id: 'welcome-block', kind: 'text', content: '' }],
  },
]
