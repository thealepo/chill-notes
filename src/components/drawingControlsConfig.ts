import {
  ArrowUpRight,
  Circle,
  Eraser,
  Hand,
  Highlighter,
  Minus,
  MousePointer2,
  Pencil,
  Square,
  StickyNote,
  Type,
} from 'lucide-react'
import type { DrawingTool } from '../types'

export const drawingColors = [
  { value: '#493d40', label: 'Charcoal' },
  { value: '#c36e82', label: 'Rose' },
  { value: '#9c6a92', label: 'Mauve' },
  { value: '#718a78', label: 'Sage' },
  { value: '#bc825d', label: 'Clay' },
  { value: '#46768c', label: 'Blue' },
]

export const drawingTools: Array<{ tool: DrawingTool; label: string; shortcut: string; icon: typeof Pencil }> = [
  { tool: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
  { tool: 'hand', label: 'Hand', shortcut: 'H', icon: Hand },
  { tool: 'pen', label: 'Pen', shortcut: 'P', icon: Pencil },
  { tool: 'highlighter', label: 'Highlight', shortcut: 'M', icon: Highlighter },
  { tool: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser },
  { tool: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: Square },
  { tool: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: Circle },
  { tool: 'line', label: 'Line', shortcut: 'L', icon: Minus },
  { tool: 'arrow', label: 'Arrow', shortcut: 'A', icon: ArrowUpRight },
  { tool: 'text', label: 'Text', shortcut: 'T', icon: Type },
  { tool: 'sticky', label: 'Sticky', shortcut: 'S', icon: StickyNote },
]
