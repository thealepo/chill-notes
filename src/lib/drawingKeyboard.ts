import type { DrawingTool } from '../types'
import type {
  DrawingElement,
  DrawingPoint,
  DrawingScene,
  DrawingShapeElement,
  DrawingStickyElement,
  DrawingTextElement,
} from './drawingScene'

export type KeyboardCreatableTool = Extract<DrawingTool, 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'text' | 'sticky'>

interface KeyboardElementOptions {
  id: string
  center: DrawingPoint
  color: string
  size: number
  stickyIndex?: number
}

const stickyColors = ['#f7d9a7', '#f5cbd5', '#d8d2ef', '#cfe5d5']

export function isKeyboardCreatableTool(tool: DrawingTool): tool is KeyboardCreatableTool {
  return tool === 'rectangle'
    || tool === 'ellipse'
    || tool === 'line'
    || tool === 'arrow'
    || tool === 'text'
    || tool === 'sticky'
}

export function nextEditableElement(
  scene: DrawingScene,
  selectedId: string | null,
  direction: -1 | 1,
): DrawingElement | undefined {
  const editableElements = scene.elements.filter((element) => element.type !== 'image')
  if (editableElements.length === 0) return undefined

  const selectedIndex = editableElements.findIndex((element) => element.id === selectedId)
  if (selectedIndex < 0) return direction === 1 ? editableElements[0] : editableElements.at(-1)

  const nextIndex = (selectedIndex + direction + editableElements.length) % editableElements.length
  return editableElements[nextIndex]
}

export function moveDrawingElement(element: DrawingElement, dx: number, dy: number): DrawingElement {
  return { ...element, x: element.x + dx, y: element.y + dy }
}

export function createKeyboardElement(
  tool: KeyboardCreatableTool,
  { id, center, color, size, stickyIndex = 0 }: KeyboardElementOptions,
): DrawingShapeElement | DrawingTextElement | DrawingStickyElement {
  const base = {
    id,
    strokeColor: color,
    strokeWidth: size,
    opacity: 1,
  }

  if (tool === 'text') {
    return {
      ...base,
      type: 'text',
      x: center.x - 130,
      y: center.y - 36,
      width: 260,
      height: 72,
      text: '',
      fontSize: 22,
    }
  }

  if (tool === 'sticky') {
    return {
      ...base,
      type: 'sticky',
      x: center.x - 110,
      y: center.y - 75,
      width: 220,
      height: 150,
      text: '',
      fontSize: 18,
      fillColor: stickyColors[stickyIndex % stickyColors.length],
    }
  }

  return {
    ...base,
    type: tool,
    x: center.x - 80,
    y: center.y - 50,
    width: 160,
    height: 100,
  }
}

export function drawingElementLabel(element: DrawingElement): string {
  if (element.type === 'highlighter') return 'Highlight'
  if (element.type === 'sticky') return 'Sticky note'
  return element.type.charAt(0).toUpperCase() + element.type.slice(1)
}
