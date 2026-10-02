export type DrawingPaper = 'dot' | 'grid' | 'lined' | 'blank'
export const DRAWING_SCENE_VERSION = 1 as const

export interface DrawingPoint {
  x: number
  y: number
  pressure: number
}

interface DrawingElementBase {
  id: string
  x: number
  y: number
  width: number
  height: number
  strokeColor: string
  strokeWidth: number
  opacity: number
}

export interface DrawingStrokeElement extends DrawingElementBase {
  type: 'pen' | 'highlighter'
  /** Normalized to the element bounds, which keeps strokes editable on resize. */
  points: DrawingPoint[]
}

export interface DrawingShapeElement extends DrawingElementBase {
  type: 'rectangle' | 'ellipse' | 'line' | 'arrow'
}

export interface DrawingTextElement extends DrawingElementBase {
  type: 'text'
  text: string
  fontSize: number
}

export interface DrawingStickyElement extends DrawingElementBase {
  type: 'sticky'
  text: string
  fontSize: number
  fillColor: string
}

export interface DrawingImageElement extends DrawingElementBase {
  type: 'image'
  source: string
  locked: true
}

export type DrawingElement =
  | DrawingStrokeElement
  | DrawingShapeElement
  | DrawingTextElement
  | DrawingStickyElement
  | DrawingImageElement

export interface DrawingScene {
  type: 'chill-drawing'
  version: typeof DRAWING_SCENE_VERSION
  paper: DrawingPaper
  elements: DrawingElement[]
}

export type DrawingSceneParseResult =
  | { status: 'supported'; scene: DrawingScene }
  | { status: 'unsupported-version'; scene: DrawingScene; version: unknown }

export interface ElementBounds {
  x: number
  y: number
  width: number
  height: number
}

const DRAWING_TYPES = new Set<DrawingElement['type']>([
  'pen',
  'highlighter',
  'rectangle',
  'ellipse',
  'line',
  'arrow',
  'text',
  'sticky',
  'image',
])
const PAPERS = new Set<DrawingPaper>(['dot', 'grid', 'lined', 'blank'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function signedDimension(value: unknown): number {
  const dimension = finite(value, 1)
  if (dimension === 0) return 1
  return Math.sign(dimension) * Math.max(1, Math.abs(dimension))
}

function normalizeElement(value: unknown): DrawingElement | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string') return null
  if (!DRAWING_TYPES.has(value.type as DrawingElement['type'])) return null

  const preservesDirection = value.type === 'line' || value.type === 'arrow'
  const base: DrawingElementBase = {
    id: value.id,
    x: finite(value.x),
    y: finite(value.y),
    width: preservesDirection ? signedDimension(value.width) : Math.max(1, finite(value.width, 1)),
    height: preservesDirection ? signedDimension(value.height) : Math.max(1, finite(value.height, 1)),
    strokeColor: typeof value.strokeColor === 'string' ? value.strokeColor : '#493d40',
    strokeWidth: Math.max(1, finite(value.strokeWidth, 3)),
    opacity: Math.min(1, Math.max(0.05, finite(value.opacity, 1))),
  }

  if (value.type === 'pen' || value.type === 'highlighter') {
    if (!Array.isArray(value.points)) return null
    const points = value.points
      .filter(isRecord)
      .map((point) => ({
        x: finite(point.x),
        y: finite(point.y),
        pressure: Math.min(1, Math.max(0, finite(point.pressure, 0.5))),
      }))
    if (points.length === 0) return null
    return { ...base, type: value.type, points }
  }

  if (value.type === 'text') {
    return {
      ...base,
      type: 'text',
      text: typeof value.text === 'string' ? value.text : '',
      fontSize: Math.max(10, finite(value.fontSize, 22)),
    }
  }

  if (value.type === 'sticky') {
    return {
      ...base,
      type: 'sticky',
      text: typeof value.text === 'string' ? value.text : '',
      fontSize: Math.max(10, finite(value.fontSize, 18)),
      fillColor: typeof value.fillColor === 'string' ? value.fillColor : '#f7d9a7',
    }
  }

  if (value.type === 'image') {
    if (typeof value.source !== 'string' || !value.source.startsWith('data:image/')) return null
    return { ...base, type: 'image', source: value.source, locked: true }
  }

  return { ...base, type: value.type as DrawingShapeElement['type'] }
}

export function createEmptyDrawingScene(): DrawingScene {
  return { type: 'chill-drawing', version: DRAWING_SCENE_VERSION, paper: 'dot', elements: [] }
}

/** Identifies unsupported scene versions so callers can preserve them without editing. */
export function parseDrawingSceneResult(value?: unknown): DrawingSceneParseResult {
  if (typeof value !== 'string' || !value) {
    return { status: 'supported', scene: createEmptyDrawingScene() }
  }
  if (value.startsWith('data:image/')) {
    return {
      status: 'supported',
      scene: {
        ...createEmptyDrawingScene(),
        elements: [{
          id: crypto.randomUUID(),
          type: 'image',
          source: value,
          locked: true,
          x: 0,
          y: 0,
          width: 1280,
          height: 720,
          strokeColor: 'transparent',
          strokeWidth: 1,
          opacity: 1,
        }],
      },
    }
  }

  try {
    const parsed: unknown = JSON.parse(value)
    if (!isRecord(parsed) || parsed.type !== 'chill-drawing') {
      return { status: 'supported', scene: createEmptyDrawingScene() }
    }
    if (parsed.version !== DRAWING_SCENE_VERSION) {
      return {
        status: 'unsupported-version',
        scene: createEmptyDrawingScene(),
        version: parsed.version,
      }
    }
    if (!Array.isArray(parsed.elements)) {
      return { status: 'supported', scene: createEmptyDrawingScene() }
    }
    const paper = typeof parsed.paper === 'string' && PAPERS.has(parsed.paper as DrawingPaper)
      ? parsed.paper as DrawingPaper
      : 'dot'
    return {
      status: 'supported',
      scene: {
        type: 'chill-drawing',
        version: DRAWING_SCENE_VERSION,
        paper,
        elements: parsed.elements.map(normalizeElement).filter((element): element is DrawingElement => element !== null),
      },
    }
  } catch {
    return { status: 'supported', scene: createEmptyDrawingScene() }
  }
}

/** Accepts the current vector scene format and upgrades the original flattened PNG format. */
export function parseDrawingScene(value?: unknown): DrawingScene {
  return parseDrawingSceneResult(value).scene
}

export function serializeDrawingScene(scene: DrawingScene): string {
  return JSON.stringify(scene)
}

/** Keeps the live textarea as the only text renderer while an element is being edited. */
export function elementsForCanvasPaint(elements: DrawingElement[], editingElementId: string | null): DrawingElement[] {
  if (!editingElementId) return elements

  return elements.flatMap((element) => {
    if (element.id !== editingElementId) return [element]
    if (element.type === 'text') return []
    if (element.type === 'sticky') return [{ ...element, text: '' }]
    return [element]
  })
}

export function normalizedStroke(
  type: DrawingStrokeElement['type'],
  points: DrawingPoint[],
  strokeColor: string,
  strokeWidth: number,
): DrawingStrokeElement {
  const minX = Math.min(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxX = Math.max(...points.map((point) => point.x))
  const maxY = Math.max(...points.map((point) => point.y))
  const width = Math.max(1, maxX - minX)
  const height = Math.max(1, maxY - minY)
  return {
    id: crypto.randomUUID(),
    type,
    x: minX,
    y: minY,
    width,
    height,
    strokeColor,
    strokeWidth,
    opacity: type === 'highlighter' ? 0.2 : 1,
    points: points.map((point) => ({
      x: (point.x - minX) / width,
      y: (point.y - minY) / height,
      pressure: point.pressure,
    })),
  }
}

export function elementBounds(element: DrawingElement): ElementBounds {
  const x = Math.min(element.x, element.x + element.width)
  const y = Math.min(element.y, element.y + element.height)
  return { x, y, width: Math.abs(element.width), height: Math.abs(element.height) }
}

/** Resizes from the selection box's bottom-right handle without changing line direction. */
export function resizeElementFromBounds(
  element: DrawingElement,
  width: number,
  height: number,
  minimumDimension = 12,
): DrawingElement {
  const bounds = elementBounds(element)
  const nextWidth = Math.max(minimumDimension, width)
  const nextHeight = Math.max(minimumDimension, height)

  if (element.type !== 'line' && element.type !== 'arrow') {
    return { ...element, x: bounds.x, y: bounds.y, width: nextWidth, height: nextHeight }
  }

  const widthDirection = Math.sign(element.width) || 1
  const heightDirection = Math.sign(element.height) || 1
  return {
    ...element,
    x: widthDirection < 0 ? bounds.x + nextWidth : bounds.x,
    y: heightDirection < 0 ? bounds.y + nextHeight : bounds.y,
    width: widthDirection * nextWidth,
    height: heightDirection * nextHeight,
  }
}

function distanceToSegment(point: DrawingPoint, start: DrawingPoint, end: DrawingPoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(point.x - (start.x + amount * dx), point.y - (start.y + amount * dy))
}

export function elementContainsPoint(element: DrawingElement, point: DrawingPoint, tolerance = 8): boolean {
  if (element.type === 'image' && element.locked) return false
  const bounds = elementBounds(element)
  if (element.type === 'rectangle' || element.type === 'text' || element.type === 'sticky') {
    return point.x >= bounds.x - tolerance && point.x <= bounds.x + bounds.width + tolerance
      && point.y >= bounds.y - tolerance && point.y <= bounds.y + bounds.height + tolerance
  }
  if (element.type === 'ellipse') {
    const radiusX = Math.max(1, bounds.width / 2)
    const radiusY = Math.max(1, bounds.height / 2)
    const normalizedX = (point.x - (bounds.x + radiusX)) / (radiusX + tolerance)
    const normalizedY = (point.y - (bounds.y + radiusY)) / (radiusY + tolerance)
    return normalizedX * normalizedX + normalizedY * normalizedY <= 1
  }
  if (element.type === 'line' || element.type === 'arrow') {
    return distanceToSegment(point, { x: element.x, y: element.y, pressure: 0.5 }, {
      x: element.x + element.width,
      y: element.y + element.height,
      pressure: 0.5,
    }) <= tolerance + element.strokeWidth
  }
  if (element.type === 'pen' || element.type === 'highlighter') {
    const points = element.points.map((item) => ({
      x: element.x + item.x * element.width,
      y: element.y + item.y * element.height,
      pressure: item.pressure,
    }))
    if (points.length === 1) return Math.hypot(point.x - points[0].x, point.y - points[0].y) <= tolerance
    return points.some((item, index) => index > 0 && distanceToSegment(point, points[index - 1], item) <= tolerance + element.strokeWidth)
  }
  return false
}

export function topElementAt(scene: DrawingScene, point: DrawingPoint, tolerance = 8): DrawingElement | undefined {
  return [...scene.elements].reverse().find((element) => elementContainsPoint(element, point, tolerance))
}

export function sceneContentBounds(scene: DrawingScene): ElementBounds | null {
  if (scene.elements.length === 0) return null
  const bounds = scene.elements.map(elementBounds)
  const x = Math.min(...bounds.map((item) => item.x))
  const y = Math.min(...bounds.map((item) => item.y))
  const right = Math.max(...bounds.map((item) => item.x + item.width))
  const bottom = Math.max(...bounds.map((item) => item.y + item.height))
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) }
}
