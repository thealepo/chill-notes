import type { NoteCover } from '../types'

export const DEFAULT_NOTE_COVER: NoteCover = 'rose'
export const MAX_NOTE_ICON_LENGTH = 16

export const NOTE_ICON_OPTIONS = [
  '🌸', '🌿', '☀️', '🌙', '✨', '💡',
  '💭', '📌', '📚', '✏️', '🎨', '🎯',
  '💗', '☕', '🌊', '🪴', '🧠', '🚀',
] as const

export const NOTE_COVER_OPTIONS: ReadonlyArray<{ id: NoteCover; label: string }> = [
  { id: 'rose', label: 'Rose garden' },
  { id: 'peach', label: 'Peach bloom' },
  { id: 'sunset', label: 'Golden sunset' },
  { id: 'lavender', label: 'Lavender mist' },
  { id: 'ocean', label: 'Quiet ocean' },
  { id: 'meadow', label: 'Soft meadow' },
  { id: 'sand', label: 'Warm sand' },
  { id: 'midnight', label: 'Midnight sky' },
]

const noteCovers = new Set<NoteCover>(NOTE_COVER_OPTIONS.map(({ id }) => id))

export function isNoteCover(value: unknown): value is NoteCover {
  return typeof value === 'string' && noteCovers.has(value as NoteCover)
}

export function normalizeNoteIcon(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (!trimmed) return undefined

  let normalized = ''
  for (const character of trimmed) {
    if (normalized.length + character.length > MAX_NOTE_ICON_LENGTH) break
    normalized += character
  }

  return normalized || undefined
}
