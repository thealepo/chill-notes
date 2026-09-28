import type { BlockKind, Note, NoteBlock } from '../types'

const BLOCK_KINDS = new Set<BlockKind>([
  'text',
  'heading1',
  'heading2',
  'heading3',
  'bullet',
  'numbered',
  'quote',
  'checklist',
  'divider',
  'code',
  'math',
])

export interface ImportedNotesResult {
  notes: Note[]
  skipped: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeImportedBlock(value: unknown): NoteBlock | null {
  if (!isRecord(value) || typeof value.kind !== 'string' || typeof value.content !== 'string') {
    return null
  }

  const kind = value.kind === 'heading' ? 'heading2' : value.kind
  if (!BLOCK_KINDS.has(kind as BlockKind)) return null
  if (kind === 'checklist' && value.checked !== undefined && typeof value.checked !== 'boolean') {
    return null
  }

  return {
    id: crypto.randomUUID(),
    kind: kind as BlockKind,
    content: value.content,
    ...(kind === 'checklist' ? { checked: value.checked === true } : {}),
  }
}

function normalizeImportedNote(value: unknown): Note | null {
  if (!isRecord(value) || !Array.isArray(value.blocks)) return null
  if (value.title !== undefined && typeof value.title !== 'string') return null
  if (value.favorite !== undefined && typeof value.favorite !== 'boolean') return null
  if (value.archived !== undefined && typeof value.archived !== 'boolean') return null
  if (value.pageIcon !== undefined && typeof value.pageIcon !== 'string') return null
  if (value.hasCover !== undefined && typeof value.hasCover !== 'boolean') return null
  if (value.drawing !== undefined && typeof value.drawing !== 'string') return null
  if (
    value.updatedAt !== undefined
    && (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt) || value.updatedAt < 0)
  ) return null

  const blocks = value.blocks
    .map(normalizeImportedBlock)
    .filter((block): block is NoteBlock => block !== null)

  if (blocks.length === 0) return null

  return {
    id: crypto.randomUUID(),
    title: value.title ?? '',
    favorite: value.favorite ?? false,
    updatedAt: value.updatedAt ?? Date.now(),
    blocks,
    ...(value.archived !== undefined ? { archived: value.archived } : {}),
    ...(value.pageIcon !== undefined ? { pageIcon: value.pageIcon } : {}),
    ...(value.hasCover !== undefined ? { hasCover: value.hasCover } : {}),
    ...(value.drawing !== undefined ? { drawing: value.drawing } : {}),
  }
}

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

export function parseImportedNotes(source: string): ImportedNotesResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(source)
  } catch {
    throw new Error('That file does not contain valid JSON.')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('The selected file must contain a JSON array of notes.')
  }

  const notes = parsed
    .map(normalizeImportedNote)
    .filter((note): note is Note => note !== null)

  return { notes, skipped: parsed.length - notes.length }
}
