import { useEffect, useRef, useState } from 'react'
import { Download, Eraser, Highlighter, Pencil, Redo2, RotateCcw, Sparkles, Trash2, Undo2 } from 'lucide-react'
import { downloadFile } from '../lib/platform'
import type { DrawingTool } from '../types'

interface DrawingCanvasProps {
  initialDrawing?: string
  onChange: (drawing: string) => void
  noteTitle: string
}

interface Point {
  x: number
  y: number
}

const HISTORY_LIMIT = 30
const HIGHLIGHTER_ALPHA = 0.18

const colors = [
  { value: '#493d40', label: 'Charcoal' },
  { value: '#c36e82', label: 'Rose' },
  { value: '#9c6a92', label: 'Mauve' },
  { value: '#718a78', label: 'Sage' },
  { value: '#bc825d', label: 'Clay' },
]

type LegacyDrawingTool = Extract<DrawingTool, 'pen' | 'highlighter' | 'eraser'>

const toolConfig: Record<LegacyDrawingTool, { label: string; icon: typeof Pencil }> = {
  pen: { label: 'Pen', icon: Pencil },
  highlighter: { label: 'Highlight', icon: Highlighter },
  eraser: { label: 'Eraser', icon: Eraser },
}

function clearCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')
  if (!context) return
  context.save()
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.restore()
}

/**
 * Paints a saved snapshot onto the canvas. The image keeps its aspect ratio and is
 * anchored top-left (never stretched), so resizing the window cannot distort a sketch.
 * `isCurrent` lets callers ignore image loads that were superseded by a newer restore.
 */
function paintSnapshot(canvas: HTMLCanvasElement, data: string, isCurrent: () => boolean) {
  clearCanvas(canvas)
  if (!data) return
  const image = new Image()
  image.onload = () => {
    if (!isCurrent()) return
    const context = canvas.getContext('2d')
    if (!context || !image.naturalWidth || !image.naturalHeight) return
    const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, image.naturalWidth * scale, image.naturalHeight * scale)
    context.restore()
  }
  image.src = data
}

export function DrawingCanvas({ initialDrawing, onChange, noteTitle }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const drawingRef = useRef(false)
  const pointsRef = useRef<Point[]>([])
  // The latest committed image; resize restoration always uses this rather than the
  // live canvas, which may be mid-restore and temporarily blank.
  const snapshotRef = useRef(initialDrawing ?? '')
  const restoreTokenRef = useRef(0)
  const [tool, setTool] = useState<DrawingTool>('pen')
  const [color, setColor] = useState(colors[1].value)
  const [size, setSize] = useState(4)
  const [history, setHistory] = useState<string[]>([initialDrawing ?? ''])
  const [historyIndex, setHistoryIndex] = useState(0)

  function restore(data: string) {
    const canvas = canvasRef.current
    if (!canvas) return
    const token = ++restoreTokenRef.current
    paintSnapshot(canvas, data, () => token === restoreTokenRef.current)
  }

  // The component is keyed by note, so the canvas only needs to be prepared on mount
  // and when its frame changes size. Saving a stroke must not trigger a reload.
  useEffect(() => {
    const canvas = canvasRef.current
    const overlay = overlayRef.current
    const frame = frameRef.current
    if (!canvas || !overlay || !frame) return

    function prepareCanvas() {
      if (!canvas || !overlay || !frame) return
      const rect = frame.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      const width = Math.max(1, Math.floor(rect.width * ratio))
      const height = Math.max(1, Math.floor(rect.height * ratio))
      if (canvas.width === width && canvas.height === height) return
      for (const element of [canvas, overlay]) {
        element.width = width
        element.height = height
        element.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0)
      }
      const token = ++restoreTokenRef.current
      paintSnapshot(canvas, snapshotRef.current, () => token === restoreTokenRef.current)
    }

    const observer = new ResizeObserver(prepareCanvas)
    observer.observe(frame)
    prepareCanvas()
    return () => observer.disconnect()
  }, [])

  function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function strokeWidth(pressure: number) {
    if (tool === 'eraser') return size * 5
    if (tool === 'highlighter') return size * 4
    return Math.max(1, size * (0.72 + pressure * 0.56))
  }

  function drawSegment(from: Point, to: Point, pressure: number) {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    context.save()
    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    context.strokeStyle = color
    context.lineWidth = strokeWidth(pressure)
    context.stroke()
    context.restore()
  }

  /** Highlighter strokes are redrawn as one path so overlapping segments don't darken. */
  function drawHighlighterPreview() {
    const overlay = overlayRef.current
    const context = overlay?.getContext('2d')
    const points = pointsRef.current
    if (!overlay || !context || points.length === 0) return
    clearCanvas(overlay)
    context.save()
    context.beginPath()
    context.moveTo(points[0].x, points[0].y)
    for (const point of points.slice(1)) context.lineTo(point.x, point.y)
    if (points.length === 1) context.lineTo(points[0].x, points[0].y)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.globalAlpha = HIGHLIGHTER_ALPHA
    context.strokeStyle = color
    context.lineWidth = strokeWidth(0.5)
    context.stroke()
    context.restore()
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    const point = canvasPoint(event)
    pointsRef.current = [point]
    if (tool === 'highlighter') drawHighlighterPreview()
    else drawSegment(point, point, event.pressure || 0.5)
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const next = canvasPoint(event)
    const previous = pointsRef.current[pointsRef.current.length - 1] ?? next
    pointsRef.current.push(next)
    if (tool === 'highlighter') drawHighlighterPreview()
    else drawSegment(previous, next, event.pressure || 0.5)
  }

  function finishDrawing() {
    if (!drawingRef.current) return
    drawingRef.current = false
    const canvas = canvasRef.current
    const overlay = overlayRef.current
    if (!canvas) return
    if (tool === 'highlighter' && overlay) {
      const context = canvas.getContext('2d')
      context?.save()
      context?.setTransform(1, 0, 0, 1, 0, 0)
      context?.drawImage(overlay, 0, 0)
      context?.restore()
      clearCanvas(overlay)
    }
    pointsRef.current = []
    // Any in-flight restore would paint over the new stroke, so cancel it.
    restoreTokenRef.current += 1
    const data = canvas.toDataURL()
    snapshotRef.current = data
    const nextHistory = [...history.slice(0, historyIndex + 1), data].slice(-HISTORY_LIMIT)
    setHistory(nextHistory)
    setHistoryIndex(nextHistory.length - 1)
    onChange(data)
  }

  function moveHistory(direction: -1 | 1) {
    const nextIndex = historyIndex + direction
    if (nextIndex < 0 || nextIndex >= history.length) return
    setHistoryIndex(nextIndex)
    snapshotRef.current = history[nextIndex]
    restore(history[nextIndex])
    onChange(history[nextIndex])
  }

  function clearSketch() {
    if (!snapshotRef.current) return
    if (!window.confirm('Clear this sketch? You can still undo it.')) return
    restore('')
    snapshotRef.current = ''
    const nextHistory = [...history.slice(0, historyIndex + 1), ''].slice(-HISTORY_LIMIT)
    setHistory(nextHistory)
    setHistoryIndex(nextHistory.length - 1)
    onChange('')
  }

  function exportDrawing() {
    const canvas = canvasRef.current
    if (!canvas) return
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = canvas.width
    exportCanvas.height = canvas.height
    const context = exportCanvas.getContext('2d')
    if (!context) return
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--drawing-paper').trim() || '#fffaf9'
    context.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    context.drawImage(canvas, 0, 0)
    const safeTitle = noteTitle.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'sketch'
    downloadFile(exportCanvas.toDataURL('image/png'), `${safeTitle}.png`)
  }

  return (
    <section className="draw-editor" aria-label="Drawing editor">
      <div className="drawing-toolbar">
        <div className="tool-group main-tools" role="group" aria-label="Drawing tool">
          {(Object.keys(toolConfig) as LegacyDrawingTool[]).map((item) => {
            const Icon = toolConfig[item].icon
            return (
              <button
                key={item}
                className={tool === item ? 'active' : ''}
                onClick={() => setTool(item)}
                aria-pressed={tool === item}
                aria-label={toolConfig[item].label}
                title={toolConfig[item].label}
              >
                <Icon size={17} /><span className="tool-label">{toolConfig[item].label}</span>
              </button>
            )
          })}
        </div>
        <div className="toolbar-divider" />
        <div className="color-picker" role="group" aria-label="Ink color">
          {colors.map((item) => (
            <button
              key={item.value}
              className={color === item.value ? 'active' : ''}
              style={{ '--swatch': item.value } as React.CSSProperties}
              onClick={() => { setColor(item.value); if (tool === 'eraser') setTool('pen') }}
              aria-label={item.label}
              aria-pressed={color === item.value}
              title={item.label}
            />
          ))}
        </div>
        <label className="stroke-size" title="Stroke size">
          <span className="stroke-preview-slot"><span className="stroke-preview" style={{ width: Math.max(3, size), height: Math.max(3, size) }} /></span>
          <input type="range" min="2" max="14" value={size} onChange={(event) => setSize(Number(event.target.value))} aria-label="Stroke size" />
        </label>
        <div className="toolbar-spacer" />
        <div className="tool-group history-tools">
          <button onClick={() => moveHistory(-1)} disabled={historyIndex <= 0} aria-label="Undo" title="Undo"><Undo2 size={17} /></button>
          <button onClick={() => moveHistory(1)} disabled={historyIndex >= history.length - 1} aria-label="Redo" title="Redo"><Redo2 size={17} /></button>
          <button onClick={clearSketch} disabled={!history[historyIndex]} aria-label="Clear canvas" title="Clear canvas"><Trash2 size={17} /></button>
          <button className="export-button" onClick={exportDrawing}><Download size={16} />Export</button>
        </div>
      </div>
      <div className="canvas-shell">
        <div className="canvas-corner-label"><Sparkles size={13} /> freeform space</div>
        <div className="canvas-frame" ref={frameRef}>
          <canvas
            ref={canvasRef}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={finishDrawing}
            onPointerCancel={finishDrawing}
            onLostPointerCapture={finishDrawing}
            onContextMenu={(event) => event.preventDefault()}
            aria-label="Drawing canvas"
          />
          <canvas ref={overlayRef} className="canvas-overlay" aria-hidden="true" />
        </div>
      </div>
      <div className="drawing-tip"><RotateCcw size={14} /> Your sketch saves automatically with this note.</div>
    </section>
  )
}
