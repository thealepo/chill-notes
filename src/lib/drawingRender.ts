import {
  elementBounds,
  elementsForCanvasPaint,
  normalizedStroke,
  type DrawingElement,
  type DrawingPaper,
  type DrawingPoint,
  type DrawingScene,
  type DrawingShapeElement,
} from './drawingScene'

export interface DrawingViewport {
  x: number
  y: number
  zoom: number
}

export type DrawingDraft =
  | { type: 'stroke'; tool: 'pen' | 'highlighter'; points: DrawingPoint[]; color: string; size: number }
  | { type: 'shape'; element: DrawingShapeElement }
  | null

const imageCache = new Map<string, HTMLImageElement>()

function cssVariable(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

export function getDrawingImage(source: string, onLoad?: () => void): HTMLImageElement {
  const cached = imageCache.get(source)
  if (cached) {
    if (onLoad && !cached.complete) cached.addEventListener('load', onLoad, { once: true })
    return cached
  }
  const image = new Image()
  if (onLoad) image.addEventListener('load', onLoad, { once: true })
  image.src = source
  imageCache.set(source, image)
  return image
}

function drawPaper(
  context: CanvasRenderingContext2D,
  paper: DrawingPaper,
  viewport: DrawingViewport,
  width: number,
  height: number,
) {
  const paperColor = cssVariable('--drawing-paper', '#fffaf9')
  const patternColor = cssVariable('--drawing-dots', '#e5d5d9')
  context.fillStyle = paperColor
  context.fillRect(0, 0, width, height)
  if (paper === 'blank') return

  const spacing = paper === 'lined' ? 32 : 24
  const left = -viewport.x / viewport.zoom
  const top = -viewport.y / viewport.zoom
  const right = left + width / viewport.zoom
  const bottom = top + height / viewport.zoom
  context.save()
  context.translate(viewport.x, viewport.y)
  context.scale(viewport.zoom, viewport.zoom)
  context.strokeStyle = patternColor
  context.fillStyle = patternColor
  context.lineWidth = 1 / viewport.zoom

  if (paper === 'dot') {
    const startX = Math.floor(left / spacing) * spacing
    const startY = Math.floor(top / spacing) * spacing
    for (let x = startX; x <= right; x += spacing) {
      for (let y = startY; y <= bottom; y += spacing) {
        context.beginPath()
        context.arc(x, y, 1.15 / viewport.zoom, 0, Math.PI * 2)
        context.fill()
      }
    }
  } else {
    context.beginPath()
    if (paper === 'grid') {
      for (let x = Math.floor(left / spacing) * spacing; x <= right; x += spacing) {
        context.moveTo(x, top)
        context.lineTo(x, bottom)
      }
    }
    for (let y = Math.floor(top / spacing) * spacing; y <= bottom; y += spacing) {
      context.moveTo(left, y)
      context.lineTo(right, y)
    }
    context.stroke()
  }
  context.restore()
}

function wrapText(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/)
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (line && context.measureText(candidate).width > width) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    lines.push(line)
  }
  return lines
}

function drawStroke(context: CanvasRenderingContext2D, element: Extract<DrawingElement, { type: 'pen' | 'highlighter' }>) {
  const points = element.points.map((point) => ({
    x: element.x + point.x * element.width,
    y: element.y + point.y * element.height,
    pressure: point.pressure,
  }))
  if (points.length === 0) return
  context.save()
  context.strokeStyle = element.strokeColor
  context.fillStyle = element.strokeColor
  context.globalAlpha = element.opacity
  context.lineCap = 'round'
  context.lineJoin = 'round'
  const multiplier = element.type === 'highlighter' ? 4 : 1
  if (points.length === 1) {
    const radius = element.strokeWidth * multiplier / 2
    context.beginPath()
    context.arc(points[0].x, points[0].y, radius, 0, Math.PI * 2)
    context.fill()
  } else {
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1]
      const point = points[index]
      const pressure = element.type === 'highlighter' ? 0.5 : (previous.pressure + point.pressure) / 2
      context.lineWidth = element.strokeWidth * multiplier * (0.72 + pressure * 0.56)
      context.beginPath()
      context.moveTo(previous.x, previous.y)
      context.lineTo(point.x, point.y)
      context.stroke()
    }
  }
  context.restore()
}

function drawArrowHead(context: CanvasRenderingContext2D, element: DrawingShapeElement) {
  const endX = element.x + element.width
  const endY = element.y + element.height
  const angle = Math.atan2(element.height, element.width)
  const length = Math.max(10, element.strokeWidth * 4)
  context.beginPath()
  context.moveTo(endX - Math.cos(angle - Math.PI / 6) * length, endY - Math.sin(angle - Math.PI / 6) * length)
  context.lineTo(endX, endY)
  context.lineTo(endX - Math.cos(angle + Math.PI / 6) * length, endY - Math.sin(angle + Math.PI / 6) * length)
  context.stroke()
}

function drawElement(context: CanvasRenderingContext2D, element: DrawingElement, onImageLoad?: () => void) {
  if (element.type === 'pen' || element.type === 'highlighter') {
    drawStroke(context, element)
    return
  }

  context.save()
  context.globalAlpha = element.opacity
  context.strokeStyle = element.strokeColor
  context.fillStyle = element.strokeColor
  context.lineWidth = element.strokeWidth
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (element.type === 'rectangle') {
    const bounds = elementBounds(element)
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
  } else if (element.type === 'ellipse') {
    const bounds = elementBounds(element)
    context.beginPath()
    context.ellipse(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, bounds.width / 2, bounds.height / 2, 0, 0, Math.PI * 2)
    context.stroke()
  } else if (element.type === 'line' || element.type === 'arrow') {
    context.beginPath()
    context.moveTo(element.x, element.y)
    context.lineTo(element.x + element.width, element.y + element.height)
    context.stroke()
    if (element.type === 'arrow') drawArrowHead(context, element)
  } else if (element.type === 'text' || element.type === 'sticky') {
    const padding = element.type === 'sticky' ? 18 : 2
    if (element.type === 'sticky') {
      context.save()
      context.shadowColor = 'rgba(79, 48, 59, 0.14)'
      context.shadowBlur = 12
      context.shadowOffsetY = 4
      context.fillStyle = element.fillColor
      context.fillRect(element.x, element.y, element.width, element.height)
      context.restore()
    }
    context.fillStyle = element.strokeColor
    context.font = `${element.fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`
    context.textBaseline = 'top'
    const lines = wrapText(context, element.text, Math.max(20, element.width - padding * 2))
    const lineHeight = element.fontSize * 1.3
    lines.slice(0, Math.max(1, Math.floor((element.height - padding * 2) / lineHeight))).forEach((line, index) => {
      context.fillText(line, element.x + padding, element.y + padding + index * lineHeight)
    })
  } else if (element.type === 'image') {
    const image = getDrawingImage(element.source, onImageLoad)
    if (image.complete && image.naturalWidth) context.drawImage(image, element.x, element.y, element.width, element.height)
  }
  context.restore()
}

function drawSelection(context: CanvasRenderingContext2D, element: DrawingElement, zoom: number) {
  const bounds = elementBounds(element)
  const color = cssVariable('--accent-strong', '#b45f78')
  context.save()
  context.strokeStyle = color
  context.fillStyle = cssVariable('--surface', '#fff')
  context.lineWidth = 1.5 / zoom
  context.setLineDash([6 / zoom, 4 / zoom])
  context.strokeRect(bounds.x - 5 / zoom, bounds.y - 5 / zoom, bounds.width + 10 / zoom, bounds.height + 10 / zoom)
  context.setLineDash([])
  const handleSize = 10 / zoom
  context.fillRect(bounds.x + bounds.width - handleSize / 2, bounds.y + bounds.height - handleSize / 2, handleSize, handleSize)
  context.strokeRect(bounds.x + bounds.width - handleSize / 2, bounds.y + bounds.height - handleSize / 2, handleSize, handleSize)
  context.restore()
}

export function paintDrawingScene(
  context: CanvasRenderingContext2D,
  scene: DrawingScene,
  viewport: DrawingViewport,
  width: number,
  height: number,
  draft: DrawingDraft,
  selectedId: string | null,
  editingElementId: string | null,
  onImageLoad?: () => void,
) {
  drawPaper(context, scene.paper, viewport, width, height)
  context.save()
  context.translate(viewport.x, viewport.y)
  context.scale(viewport.zoom, viewport.zoom)
  elementsForCanvasPaint(scene.elements, editingElementId)
    .forEach((element) => drawElement(context, element, onImageLoad))
  if (draft?.type === 'stroke' && draft.points.length) {
    drawStroke(context, normalizedStroke(draft.tool, draft.points, draft.color, draft.size))
  } else if (draft?.type === 'shape') {
    drawElement(context, draft.element)
  }
  const selected = selectedId ? scene.elements.find((element) => element.id === selectedId) : undefined
  if (selected) drawSelection(context, selected, viewport.zoom)
  context.restore()
}

export function safeDrawingFilename(title: string): string {
  return title.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'sketch'
}
