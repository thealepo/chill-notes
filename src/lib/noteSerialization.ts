import type { Note, NoteBlock } from '../types'

export function normalizeLegacyBlockKind(block: NoteBlock): NoteBlock {
  if ((block.kind as string) !== 'heading') return block

  return { ...block, kind: 'heading2' }
}

export function normalizeStoredNotes(notes: Note[]): Note[] {
  return notes.map((note) => ({
    ...note,
    blocks: note.blocks.map(normalizeLegacyBlockKind),
  }))
}
