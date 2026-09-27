import { useEffect, useRef, useState } from 'react'
import { Download, Eraser, Highlighter, Pencil, Redo2, RotateCcw, Sparkles, Trash2, Undo2 } from 'lucide-react'
import type { DrawingTool } from '../types'

interface DrawingCanvasProps {
  initialDrawing?: string
  onChange: (drawing: string) => void
  noteTitle: string
}

const colors = [
  { value: '#493d40', label: 'Charcoal' },
  { value: '#c36e82', label: 'Rose' },
  { value: '#9c6a92', label: 'Mauve' },
  { value: '#718a78', label: 'Sage' },
  { value: '#bc825d', label: 'Clay' },
]

const toolConfig: Record<DrawingTool, { label: string; icon: typeof Pencil }> = {
  pen: { label: 'Pen', icon: Pencil },
  highlighter: { label: 'Highlight', icon: Highlighter },
  eraser: { label: 'Eraser', icon: Eraser },
}

export function DrawingCanvas({ initialDrawing, onChange, noteTitle }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const drawingRef = useRef(false)
  const pointRef = useRef({ x: 0, y: 0 })
  const hasInitialized = useRef(false)
  const [tool, setTool] = useState<DrawingTool>('pen')
  const [color, setColor] = useState(colors[1].value)
  const [size, setSize] = useState(4)
  const [history, setHistory] = useState<string[]>(initialDrawing ? [initialDrawing] : [''])
  const [historyIndex, setHistoryIndex] = useState(0)

  function restore(data: string) {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.restore()
    if (!data) return
    const image = new Image()
    image.onload = () => {
      context.save()
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      context.restore()
    }
    image.src = data
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current
    if (!canvas || !frame) return

    function prepareCanvas() {
      if (!canvas || !frame) return
      const previous = canvas.width ? canvas.toDataURL() : initialDrawing
      const rect = frame.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.floor(rect.width * ratio)
      canvas.height = Math.floor(rect.height * ratio)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      canvas.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0)
      const source = hasInitialized.current ? previous : initialDrawing
      hasInitialized.current = true
      if (source) restore(source)
    }

    const observer = new ResizeObserver(prepareCanvas)
    observer.observe(frame)
    prepareCanvas()
    return () => observer.disconnect()
  }, [initialDrawing])

  function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    pointRef.current = canvasPoint(event)
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const next = canvasPoint(event)
    const pressure = event.pressure || 0.5
    context.beginPath()
    context.moveTo(pointRef.current.x, pointRef.current.y)
    context.lineTo(next.x, next.y)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    context.globalAlpha = tool === 'highlighter' ? 0.18 : 1
    context.strokeStyle = color
    context.lineWidth = tool === 'eraser' ? size * 5 : tool === 'highlighter' ? size * 4 : Math.max(1, size * (0.72 + pressure * 0.56))
    context.stroke()
    context.globalAlpha = 1
    context.globalCompositeOperation = 'source-over'
    pointRef.current = next
  }

  function finishDrawing() {
    if (!drawingRef.current) return
    drawingRef.current = false
    const data = canvasRef.current?.toDataURL() ?? ''
    const nextHistory = [...history.slice(0, historyIndex + 1), data].slice(-30)
    setHistory(nextHistory)
    setHistoryIndex(nextHistory.length - 1)
    onChange(data)
  }

  function moveHistory(direction: -1 | 1) {
    const nextIndex = historyIndex + direction
    if (nextIndex < 0 || nextIndex >= history.length) return
    setHistoryIndex(nextIndex)
    restore(history[nextIndex])
    onChange(history[nextIndex])
  }

  function clearCanvas() {
    if (!window.confirm('Clear this sketch? You can still undo it.')) return
    restore('')
    const nextHistory = [...history.slice(0, historyIndex + 1), ''].slice(-30)
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
    context.fillStyle = '#fffdfb'
    context.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    context.drawImage(canvas, 0, 0)
    const link = document.createElement('a')
    const safeTitle = noteTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sketch'
    link.download = `${safeTitle}.png`
    link.href = exportCanvas.toDataURL('image/png')
    link.click()
  }

  return (
    <section className="draw-editor" aria-label="Drawing editor">
      <div className="drawing-toolbar">
        <div className="tool-group main-tools">
          {(Object.keys(toolConfig) as DrawingTool[]).map((item) => {
            const Icon = toolConfig[item].icon
            return <button key={item} className={tool === item ? 'active' : ''} onClick={() => setTool(item)}><Icon size={17} />{toolConfig[item].label}</button>
          })}
        </div>
        <div className="toolbar-divider" />
        <div className="color-picker" aria-label="Ink color">
          {colors.map((item) => (
            <button key={item.value} className={color === item.value ? 'active' : ''} style={{ '--swatch': item.value } as React.CSSProperties} onClick={() => { setColor(item.value); if (tool === 'eraser') setTool('pen') }} aria-label={item.label} title={item.label} />
          ))}
        </div>
        <label className="stroke-size">
          <span className="stroke-preview" style={{ width: Math.max(3, size), height: Math.max(3, size) }} />
          <input type="range" min="2" max="14" value={size} onChange={(event) => setSize(Number(event.target.value))} aria-label="Stroke size" />
        </label>
        <div className="toolbar-spacer" />
        <div className="tool-group history-tools">
          <button onClick={() => moveHistory(-1)} disabled={historyIndex <= 0} aria-label="Undo"><Undo2 size={17} /></button>
          <button onClick={() => moveHistory(1)} disabled={historyIndex >= history.length - 1} aria-label="Redo"><Redo2 size={17} /></button>
          <button onClick={clearCanvas} aria-label="Clear canvas"><Trash2 size={17} /></button>
          <button className="export-button" onClick={exportDrawing}><Download size={16} />Export</button>
        </div>
      </div>
      <div className="canvas-shell">
        <div className="canvas-corner-label"><Sparkles size={13} /> freeform space</div>
        <div className="canvas-frame" ref={frameRef}>
          <canvas ref={canvasRef} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={finishDrawing} onPointerCancel={finishDrawing} aria-label="Drawing canvas" />
        </div>
      </div>
      <div className="drawing-tip"><RotateCcw size={14} /> Your sketch saves automatically with this note.</div>
    </section>
  )
}
