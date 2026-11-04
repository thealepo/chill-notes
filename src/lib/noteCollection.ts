import type { Note } from '../types'

export type NoteView = 'notes' | 'archive'
export type SortOrder = 'updated' | 'title'

export interface NoteListOptions {
  view: NoteView
  query: string
  favoritesOnly: boolean
  sortOrder: SortOrder
}

type IdFactory = () => string

const createRandomId: IdFactory = () => crypto.randomUUID()

export function createBlankNote(now = Date.now(), createId: IdFactory = createRandomId): Note {
  return {
    id: createId(),
    title: '',
    favorite: false,
    updatedAt: now,
    blocks: [{ id: createId(), kind: 'text', content: '' }],
  }
}

export function duplicateNote(
  note: Note,
  now = Date.now(),
  createId: IdFactory = createRandomId,
): Note {
  return {
    ...note,
    id: createId(),
    title: note.title ? `${note.title} copy` : 'Untitled note copy',
    updatedAt: now,
    blocks: note.blocks.map((block) => ({ ...block, id: createId() })),
  }
}

export function getVisibleNotes(notes: Note[], options: NoteListOptions): Note[] {
  const normalizedQuery = options.query.trim().toLowerCase()

  return notes
    .filter((note) => {
      if (Boolean(note.archived) !== (options.view === 'archive')) return false
      if (options.favoritesOnly && !note.favorite) return false
      if (!normalizedQuery) return true
      const body = note.blocks.map((block) => block.content).join(' ')
      return `${note.title} ${body}`.toLowerCase().includes(normalizedQuery)
    })
    .sort((a, b) => options.sortOrder === 'title'
      ? (a.title || 'Untitled note').localeCompare(b.title || 'Untitled note')
      : b.updatedAt - a.updatedAt)
}
