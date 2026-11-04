import type { BlockKind, NoteBlock } from '../types'

interface InsertNoteBlockOptions {
  content?: string
  patchCurrent?: Partial<NoteBlock>
}

export interface InsertedNoteBlock {
  blocks: NoteBlock[]
  block: NoteBlock
}

export interface RemovedNoteBlock {
  blocks: NoteBlock[]
  focusId: string
}

export interface MergedNoteBlock {
  blocks: NoteBlock[]
  focusId: string
  caret: number
}

export function updateNoteBlock(blocks: NoteBlock[], id: string, patch: Partial<NoteBlock>): NoteBlock[] {
  return blocks.map((block) => (block.id === id ? { ...block, ...patch } : block))
}

export function insertNoteBlock(
  blocks: NoteBlock[],
  kind: BlockKind,
  afterId: string | undefined,
  options: InsertNoteBlockOptions,
  createId: () => string,
): InsertedNoteBlock {
  const block: NoteBlock = {
    id: createId(),
    kind,
    content: options.content ?? '',
    ...(kind === 'checklist' ? { checked: false } : {}),
  }
  const afterIndex = afterId ? blocks.findIndex((item) => item.id === afterId) : blocks.length - 1
  const next = blocks.map((item) => (
    item.id === afterId && options.patchCurrent ? { ...item, ...options.patchCurrent } : item
  ))
  next.splice(afterIndex + 1, 0, block)
  return { blocks: next, block }
}

export function removeNoteBlock(blocks: NoteBlock[], id: string): RemovedNoteBlock | null {
  const index = blocks.findIndex((block) => block.id === id)
  if (index < 0) return null
  if (blocks.length === 1) {
    return {
      blocks: updateNoteBlock(blocks, id, { kind: 'text', content: '', checked: false }),
      focusId: id,
    }
  }
  const next = blocks.filter((block) => block.id !== id)
  return { blocks: next, focusId: next[Math.max(0, index - 1)].id }
}

export function duplicateNoteBlock(
  blocks: NoteBlock[],
  id: string,
  createId: () => string,
): InsertedNoteBlock | null {
  const index = blocks.findIndex((block) => block.id === id)
  if (index < 0) return null
  const block = { ...blocks[index], id: createId() }
  const next = [...blocks]
  next.splice(index + 1, 0, block)
  return { blocks: next, block }
}

export function moveNoteBlock(blocks: NoteBlock[], id: string, direction: -1 | 1): NoteBlock[] {
  const index = blocks.findIndex((block) => block.id === id)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= blocks.length) return blocks
  const next = [...blocks]
  const [block] = next.splice(index, 1)
  next.splice(nextIndex, 0, block)
  return next
}

export function reorderNoteBlock(
  blocks: NoteBlock[],
  movingId: string,
  targetId: string,
  position: 'before' | 'after',
): NoteBlock[] {
  if (movingId === targetId) return blocks
  const moving = blocks.find((block) => block.id === movingId)
  if (!moving) return blocks
  const next = blocks.filter((block) => block.id !== movingId)
  const targetIndex = next.findIndex((block) => block.id === targetId)
  if (targetIndex < 0) return blocks
  next.splice(position === 'before' ? targetIndex : targetIndex + 1, 0, moving)
  return next.every((block, index) => block === blocks[index]) ? blocks : next
}

export function mergeNoteBlockIntoPrevious(blocks: NoteBlock[], id: string): MergedNoteBlock | null {
  const index = blocks.findIndex((block) => block.id === id)
  const current = blocks[index]
  const previous = blocks[index - 1]
  if (!current || !previous) return null
  const caret = previous.content.length
  return {
    blocks: blocks
      .filter((block) => block.id !== id)
      .map((block) => (block.id === previous.id
        ? { ...block, content: previous.content + current.content }
        : block)),
    focusId: previous.id,
    caret,
  }
}

export function numberedNoteBlockPosition(blocks: NoteBlock[], index: number): number {
  let position = 1
  for (let current = index - 1; current >= 0; current -= 1) {
    if (blocks[current].kind !== 'numbered') break
    position += 1
  }
  return position
}
