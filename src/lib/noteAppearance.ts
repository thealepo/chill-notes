import type { NoteCover } from '../types'

export const DEFAULT_NOTE_COVER: NoteCover = 'rose'

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
