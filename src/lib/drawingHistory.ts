import type { DrawingScene } from './drawingScene'

export const DRAWING_HISTORY_LIMIT = 60

export interface DrawingHistoryUpdate {
  entries: DrawingScene[]
  index: number
}

export interface DrawingHistoryStep {
  index: number
  scene: DrawingScene
}

export function appendDrawingHistory(
  entries: DrawingScene[],
  currentIndex: number,
  next: DrawingScene,
  limit = DRAWING_HISTORY_LIMIT,
): DrawingHistoryUpdate {
  const safeLimit = Math.max(1, Math.floor(limit))
  const nextEntries = [
    ...entries.slice(0, currentIndex + 1),
    structuredClone(next),
  ].slice(-safeLimit)
  return { entries: nextEntries, index: nextEntries.length - 1 }
}

export function stepDrawingHistory(
  entries: DrawingScene[],
  currentIndex: number,
  direction: -1 | 1,
): DrawingHistoryStep | null {
  const nextIndex = currentIndex + direction
  if (nextIndex < 0 || nextIndex >= entries.length) return null
  return { index: nextIndex, scene: structuredClone(entries[nextIndex]) }
}
