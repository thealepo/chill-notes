import type { Note } from './types'

export const starterNotes: Note[] = [
  {
    id: 'slow-morning',
    title: 'A slow morning',
    updatedAt: Date.now(),
    favorite: true,
    blocks: [
      { id: 'sm-1', kind: 'text', content: 'A few soft thoughts before the day begins.' },
      { id: 'sm-2', kind: 'heading', content: 'Small intentions' },
      { id: 'sm-3', kind: 'checklist', content: 'Drink water before coffee', checked: true },
      { id: 'sm-4', kind: 'checklist', content: 'Take the long way home', checked: false },
      { id: 'sm-5', kind: 'quote', content: 'There is no hurry. This moment is enough.' },
      { id: 'sm-6', kind: 'math', content: 'e^{i\\pi} + 1 = 0' },
    ],
  },
  {
    id: 'garden-ideas',
    title: 'Garden ideas',
    updatedAt: Date.now() - 1000 * 60 * 60 * 5,
    favorite: false,
    blocks: [
      { id: 'gi-1', kind: 'text', content: 'Lavender near the kitchen window, herbs along the back wall.' },
      { id: 'gi-2', kind: 'checklist', content: 'Measure the sunny corner', checked: false },
    ],
  },
  {
    id: 'reading-list',
    title: 'Things to read',
    updatedAt: Date.now() - 1000 * 60 * 60 * 28,
    favorite: false,
    blocks: [
      { id: 'rl-1', kind: 'heading', content: 'For a rainy afternoon' },
      { id: 'rl-2', kind: 'text', content: 'Poetry, essays, and one very long novel.' },
    ],
  },
]
