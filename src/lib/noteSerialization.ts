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
  const kind = block.kind as string
  if (kind === 'heading') return { ...block, kind: 'heading2' }
  if (!BLOCK_KINDS.has(kind as BlockKind)) return { ...block, kind: 'text' }
  return block
}

function normalizeStoredBlock(value: unknown): NoteBlock | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.content !== 'string') return null

  const rawKind = typeof value.kind === 'string' ? value.kind : 'text'
  const kind = rawKind === 'heading'
    ? 'heading2'
    : BLOCK_KINDS.has(rawKind as BlockKind) ? rawKind as BlockKind : 'text'

  return {
    id: value.id,
    kind,
    content: value.content,
    ...(kind === 'checklist' ? { checked: value.checked === true } : {}),
  }
}

/**
 * Migrates notes read from local storage. Unlike imports, stored notes keep their IDs;
 * entries without a usable block array are dropped instead of failing the whole read.
 */
export function normalizeStoredNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return []
  return value
    .map((value): Note | null => {
      if (!isRecord(value) || typeof value.id !== 'string' || !Array.isArray(value.blocks)) return null
      const blocks = value.blocks
        .map(normalizeStoredBlock)
        .filter((block): block is NoteBlock => block !== null)
      if (blocks.length === 0) return null

      return {
        id: value.id,
        title: typeof value.title === 'string' ? value.title : '',
        updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt >= 0
          ? value.updatedAt
          : Date.now(),
        favorite: value.favorite === true,
        blocks,
        ...(typeof value.pageIcon === 'string' ? { pageIcon: value.pageIcon } : {}),
        ...(typeof value.hasCover === 'boolean' ? { hasCover: value.hasCover } : {}),
        ...(typeof value.archived === 'boolean' ? { archived: value.archived } : {}),
        ...(typeof value.drawing === 'string' ? { drawing: value.drawing } : {}),
      }
    })
    .filter((note): note is Note => note !== null)
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

function isListBlock(kind: BlockKind): boolean {
  return kind === 'bullet' || kind === 'numbered' || kind === 'checklist'
}

function codeFence(content: string): string {
  const longestRun = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length))
  const fence = '`'.repeat(Math.max(3, longestRun + 1))
  return `${fence}\n${content}\n${fence}`
}

function renderMarkdownBlock(block: NoteBlock, numberedIndex: number): string {
  switch (block.kind) {
    case 'text':
      return block.content
    case 'heading1':
      return `# ${block.content}`
    case 'heading2':
      return `## ${block.content}`
    case 'heading3':
      return `### ${block.content}`
    case 'bullet':
      return `- ${block.content}`
    case 'numbered':
      return `${numberedIndex}. ${block.content}`
    case 'checklist':
      return `- [${block.checked ? 'x' : ' '}] ${block.content}`
    case 'quote':
      return block.content.split('\n').map((line) => line ? `> ${line}` : '>').join('\n')
    case 'divider':
      return '---'
    case 'code':
      return codeFence(block.content)
    case 'math':
      return `$$\n${block.content}\n$$`
  }
}

export function noteToMarkdown(note: Note): string {
  const sections: Array<{ content: string; kind?: BlockKind }> = []
  const title = note.title.trim()
  if (title) sections.push({ content: `# ${title}` })

  let numberedIndex = 0
  for (const block of note.blocks) {
    numberedIndex = block.kind === 'numbered' ? numberedIndex + 1 : 0
    const content = renderMarkdownBlock(block, numberedIndex)
    if (content) sections.push({ content, kind: block.kind })
  }

  if (note.drawing) {
    sections.push({ content: '<!-- This note has a drawing that is not included in the Markdown export. -->' })
  }

  const markdown = sections.reduce((output, section, index) => {
    if (index === 0) return section.content
    const previous = sections[index - 1]
    const compactList = previous.kind && section.kind
      && isListBlock(previous.kind) && isListBlock(section.kind)
    return `${output}${compactList ? '\n' : '\n\n'}${section.content}`
  }, '')

  return markdown ? `${markdown}\n` : ''
}

export function markdownFilename(title: string): string {
  let filename = title
    .normalize('NFKC')
    .replace(/\p{Cc}|[<>:"/\\|?*]/gu, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 80)
    .replace(/[.\s]+$/g, '')

  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(filename)) {
    filename = `note-${filename}`
  }

  return `${filename || 'untitled-note'}.md`
}
