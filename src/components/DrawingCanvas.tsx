import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Circle,
  Copy,
  Download,
  Eraser,
  Hand,
  Highlighter,
  Maximize2,
  Minus,
  MousePointer2,
  Pencil,
  Redo2,
  RotateCcw,
  Sparkles,
  Square,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  DRAWING_SCENE_VERSION,
  elementBounds,
  normalizedStroke,
  parseDrawingSceneResult,
  resizeElementFromBounds,
  sceneContentBounds,
  serializeDrawingScene,
  topElementAt,
  type DrawingElement,
  type DrawingPaper,
  type DrawingPoint,
  type DrawingScene,
  type DrawingShapeElement,
  type DrawingStickyElement,
  type DrawingTextElement,
} from '../lib/drawingScene'
import {
  createKeyboardElement,
  drawingElementLabel,
  isKeyboardCreatableTool,
  moveDrawingElement,
  nextEditableElement,
} from '../lib/drawingKeyboard'
import {
  getDrawingImage,
  paintDrawingScene,
  safeDrawingFilename,
  type DrawingDraft,
  type DrawingViewport,
} from '../lib/drawingRender'
import { waitForImageLoad } from '../lib/imageLoading'
import { downloadFile } from '../lib/platform'
import type { DrawingTool } from '../types'

interface DrawingCanvasProps {
  initialDrawing?: string
  onChange: (drawing: string) => void
  noteTitle: string
}

interface CanvasSize {
  width: number
  height: number
  ratio: number
}

type PointerGesture =
  | { type: 'draw'; pointerId: number }
  | { type: 'shape'; pointerId: number; start: DrawingPoint }
  | { type: 'move'; pointerId: number; start: DrawingPoint; before: DrawingScene; element: DrawingElement }
  | { type: 'resize'; pointerId: number; before: DrawingScene; element: DrawingElement }
  | { type: 'pan'; pointerId: number; startX: number; startY: number; viewport: DrawingViewport }
  | { type: 'erase'; pointerId: number; before: DrawingScene; changed: boolean }
  | null

interface TextEditingState {
  id: string
  before: DrawingScene
}

const HISTORY_LIMIT = 60
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const DEFAULT_VIEWPORT: DrawingViewport = { x: 48, y: 42, zoom: 1 }

const colors = [
  { value: '#493d40', label: 'Charcoal' },
  { value: '#c36e82', label: 'Rose' },
  { value: '#9c6a92', label: 'Mauve' },
  { value: '#718a78', label: 'Sage' },
  { value: '#bc825d', label: 'Clay' },
  { value: '#46768c', label: 'Blue' },
]

const stickyColors = ['#f7d9a7', '#f5cbd5', '#d8d2ef', '#cfe5d5']

const toolConfig: Array<{ tool: DrawingTool; label: string; shortcut: string; icon: typeof Pencil }> = [
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

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function cloneScene(scene: DrawingScene): DrawingScene {
  return structuredClone(scene)
}

function cloneElement<T extends DrawingElement>(element: T): T {
  return structuredClone(element)
}

function drawingValue(scene: DrawingScene): string {
  return scene.elements.length === 0 && scene.paper === 'dot' ? '' : serializeDrawingScene(scene)
}

export function DrawingCanvas({ initialDrawing, onChange, noteTitle }: DrawingCanvasProps) {
  const initialParseRef = useRef(parseDrawingSceneResult(initialDrawing))
  const initialSceneRef = useRef(initialParseRef.current.scene)
  const [scene, setScene] = useState(initialSceneRef.current)
  const sceneRef = useRef(scene)
  const [history, setHistory] = useState<DrawingScene[]>([initialSceneRef.current])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [tool, setTool] = useState<DrawingTool>('select')
  const [color, setColor] = useState(colors[0].value)
  const [size, setSize] = useState(4)
  const [viewport, setViewport] = useState<DrawingViewport>(DEFAULT_VIEWPORT)
  const viewportRef = useRef(viewport)
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 1, height: 1, ratio: 1 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DrawingDraft>(null)
  const draftRef = useRef<DrawingDraft>(null)
  const gestureRef = useRef<PointerGesture>(null)
  const spacePanningRef = useRef(false)
  const [editing, setEditing] = useState<TextEditingState | null>(null)
  const [keyboardStatus, setKeyboardStatus] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)
  const keyboardMoveRef = useRef<string | null>(null)
  const announcementFrameRef = useRef<number | null>(null)
  const [imageVersion, setImageVersion] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState('')
  const keyboardInstructionsId = useId()
  const keyboardStatusId = useId()

  const selectedElement = useMemo(
    () => scene.elements.find((element) => element.id === selectedId),
    [scene.elements, selectedId],
  )

  const setLiveScene = useCallback((next: DrawingScene) => {
    sceneRef.current = next
    setScene(next)
  }, [])

  const setLiveViewport = useCallback((next: DrawingViewport) => {
    viewportRef.current = next
    setViewport(next)
  }, [])

  const setLiveDraft = useCallback((next: DrawingDraft) => {
    draftRef.current = next
    setDraft(next)
  }, [])

  const announce = useCallback((message: string) => {
    if (announcementFrameRef.current !== null) cancelAnimationFrame(announcementFrameRef.current)
    setKeyboardStatus('')
    announcementFrameRef.current = requestAnimationFrame(() => {
      setKeyboardStatus(message)
      announcementFrameRef.current = null
    })
  }, [])

  useEffect(() => () => {
    if (announcementFrameRef.current !== null) cancelAnimationFrame(announcementFrameRef.current)
  }, [])

  useEffect(() => {
    if (!exportStatus || exporting) return
    const timeout = window.setTimeout(() => setExportStatus(''), 6_000)
    return () => window.clearTimeout(timeout)
  }, [exportStatus, exporting])

  const commitScene = useCallback((next: DrawingScene) => {
    setLiveScene(next)
    const nextHistory = [...history.slice(0, historyIndex + 1), cloneScene(next)].slice(-HISTORY_LIMIT)
    setHistory(nextHistory)
    setHistoryIndex(nextHistory.length - 1)
    onChange(drawingValue(next))
  }, [history, historyIndex, onChange, setLiveScene])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const prepare = () => {
      const rect = frame.getBoundingClientRect()
      setCanvasSize({
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
        ratio: window.devicePixelRatio || 1,
      })
    }
    const observer = new ResizeObserver(prepare)
    observer.observe(frame)
    prepare()
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = Math.floor(canvasSize.width * canvasSize.ratio)
    canvas.height = Math.floor(canvasSize.height * canvasSize.ratio)
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(canvasSize.ratio, 0, 0, canvasSize.ratio, 0, 0)
    context.clearRect(0, 0, canvasSize.width, canvasSize.height)
    paintDrawingScene(
      context,
      scene,
      viewport,
      canvasSize.width,
      canvasSize.height,
      draft,
      selectedId,
      editing?.id ?? null,
      () => setImageVersion((version) => version + 1),
    )
  }, [canvasSize, draft, editing?.id, imageVersion, scene, selectedId, viewport])

  useEffect(() => {
    if (editing) requestAnimationFrame(() => textInputRef.current?.focus())
  }, [editing])

  const moveHistory = useCallback((direction: -1 | 1) => {
    const nextIndex = historyIndex + direction
    if (nextIndex < 0 || nextIndex >= history.length) return
    const next = cloneScene(history[nextIndex])
    setHistoryIndex(nextIndex)
    setSelectedId(null)
    setLiveScene(next)
    onChange(drawingValue(next))
  }, [history, historyIndex, onChange, setLiveScene])

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    const next = { ...sceneRef.current, elements: sceneRef.current.elements.filter((element) => element.id !== selectedId) }
    setSelectedId(null)
    commitScene(next)
  }, [commitScene, selectedId])

  const finishKeyboardMove = useCallback(() => {
    if (!keyboardMoveRef.current) return
    keyboardMoveRef.current = null
    commitScene(sceneRef.current)
  }, [commitScene])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        moveHistory(event.shiftKey ? 1 : -1)
        return
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        if (selectedId) event.preventDefault()
        deleteSelected()
        return
      }
      if (event.code === 'Space') {
        if (target !== canvasRef.current) return
        event.preventDefault()
        spacePanningRef.current = true
        return
      }
      const shortcut = toolConfig.find((item) => item.shortcut.toLowerCase() === event.key.toLowerCase())
      if (shortcut && !event.metaKey && !event.ctrlKey && !event.altKey) setTool(shortcut.tool)
      if ((event.key === '+' || event.key === '=') && !event.metaKey && !event.ctrlKey) {
        setLiveViewport({ ...viewportRef.current, zoom: clampZoom(viewportRef.current.zoom * 1.15) })
      }
      if (event.key === '-' && !event.metaKey && !event.ctrlKey) {
        setLiveViewport({ ...viewportRef.current, zoom: clampZoom(viewportRef.current.zoom / 1.15) })
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spacePanningRef.current = false
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [deleteSelected, moveHistory, selectedId, setLiveViewport])

  function screenPoint(clientX: number, clientY: number): DrawingPoint {
    const rect = canvasRef.current?.getBoundingClientRect()
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0), pressure: 0.5 }
  }

  function worldPoint(clientX: number, clientY: number, pressure = 0.5): DrawingPoint {
    const screen = screenPoint(clientX, clientY)
    const view = viewportRef.current
    return {
      x: (screen.x - view.x) / view.zoom,
      y: (screen.y - view.y) / view.zoom,
      pressure: pressure || 0.5,
    }
  }

  function resizeHandleContains(element: DrawingElement, point: DrawingPoint): boolean {
    const bounds = elementBounds(element)
    const tolerance = 14 / viewportRef.current.zoom
    return Math.hypot(point.x - (bounds.x + bounds.width), point.y - (bounds.y + bounds.height)) <= tolerance
  }

  function startTextEditing(type: 'text' | 'sticky', point: DrawingPoint, existing?: DrawingTextElement | DrawingStickyElement) {
    const before = cloneScene(sceneRef.current)
    if (existing) {
      setSelectedId(existing.id)
      setEditing({ id: existing.id, before })
      return
    }
    const base = {
      id: crypto.randomUUID(),
      x: point.x,
      y: point.y,
      width: type === 'sticky' ? 220 : 260,
      height: type === 'sticky' ? 150 : 72,
      strokeColor: color,
      strokeWidth: size,
      opacity: 1,
      text: '',
      fontSize: type === 'sticky' ? 18 : 22,
    }
    const element: DrawingTextElement | DrawingStickyElement = type === 'sticky'
      ? { ...base, type: 'sticky', fillColor: stickyColors[sceneRef.current.elements.length % stickyColors.length] }
      : { ...base, type: 'text' }
    setLiveScene({ ...sceneRef.current, elements: [...sceneRef.current.elements, element] })
    setSelectedId(element.id)
    setEditing({ id: element.id, before })
  }

  function visibleCanvasCenter(): DrawingPoint {
    const view = viewportRef.current
    return {
      x: (canvasSize.width / 2 - view.x) / view.zoom,
      y: (canvasSize.height / 2 - view.y) / view.zoom,
      pressure: 0.5,
    }
  }

  function cycleKeyboardSelection(direction: -1 | 1) {
    const next = nextEditableElement(sceneRef.current, selectedId, direction)
    if (!next) {
      announce('The canvas has no editable objects.')
      return
    }
    const editableElements = sceneRef.current.elements.filter((element) => element.type !== 'image')
    const position = editableElements.findIndex((element) => element.id === next.id) + 1
    setSelectedId(next.id)
    announce(`${drawingElementLabel(next)} selected, object ${position} of ${editableElements.length}. Use the arrow keys to move it.`)
  }

  function createObjectFromKeyboard() {
    if (!isKeyboardCreatableTool(tool)) {
      announce(tool === 'select'
        ? 'Press Enter to select the next object, or Shift Enter for the previous object.'
        : 'Choose Rectangle, Ellipse, Line, Arrow, Text, or Sticky before pressing Enter to create.')
      return
    }

    const before = cloneScene(sceneRef.current)
    const element = createKeyboardElement(tool, {
      id: crypto.randomUUID(),
      center: visibleCanvasCenter(),
      color,
      size,
      stickyIndex: sceneRef.current.elements.length,
    })
    const next = { ...sceneRef.current, elements: [...sceneRef.current.elements, element] }
    setSelectedId(element.id)

    if (element.type === 'text' || element.type === 'sticky') {
      setLiveScene(next)
      setEditing({ id: element.id, before })
      announce(`${drawingElementLabel(element)} created at the center of the canvas. Start typing.`)
      return
    }

    commitScene(next)
    announce(`${drawingElementLabel(element)} created and selected at the center of the canvas.`)
  }

  function nudgeSelected(dx: number, dy: number) {
    if (!selectedId) {
      announce('No object selected. Press V, then Enter to select an object.')
      return
    }
    const selected = sceneRef.current.elements.find((element) => element.id === selectedId)
    if (!selected || selected.type === 'image') return
    if (!keyboardMoveRef.current) keyboardMoveRef.current = selected.id
    const next = {
      ...sceneRef.current,
      elements: sceneRef.current.elements.map((element) => element.id === selected.id
        ? moveDrawingElement(element, dx, dy)
        : element),
    }
    setLiveScene(next)
    const distance = Math.abs(dx || dy)
    const direction = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down'
    announce(`${drawingElementLabel(selected)} moved ${distance} pixel${distance === 1 ? '' : 's'} ${direction}.`)
  }

  function handleCanvasKeyDown(event: React.KeyboardEvent<HTMLCanvasElement>) {
    if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      if (tool === 'select') cycleKeyboardSelection(event.shiftKey ? -1 : 1)
      else createObjectFromKeyboard()
      return
    }
    if (event.key === 'Escape') {
      if (!selectedId) return
      event.preventDefault()
      setSelectedId(null)
      announce('Object selection cleared.')
      return
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      if (!selectedElement || selectedElement.type === 'image') return
      event.preventDefault()
      event.stopPropagation()
      const label = drawingElementLabel(selectedElement)
      deleteSelected()
      announce(`${label} deleted.`)
      return
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.startsWith('Arrow')) {
      event.preventDefault()
      const distance = event.shiftKey ? 10 : 1
      if (event.key === 'ArrowLeft') nudgeSelected(-distance, 0)
      if (event.key === 'ArrowRight') nudgeSelected(distance, 0)
      if (event.key === 'ArrowUp') nudgeSelected(0, -distance)
      if (event.key === 'ArrowDown') nudgeSelected(0, distance)
    }
  }

  function handleCanvasKeyUp(event: React.KeyboardEvent<HTMLCanvasElement>) {
    if (event.key.startsWith('Arrow')) finishKeyboardMove()
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = worldPoint(event.clientX, event.clientY, event.pressure)
    const shouldPan = tool === 'hand' || spacePanningRef.current || event.button === 1

    if (shouldPan) {
      gestureRef.current = {
        type: 'pan',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        viewport: { ...viewportRef.current },
      }
      return
    }

    if (tool === 'select') {
      if (selectedElement && resizeHandleContains(selectedElement, point)) {
        gestureRef.current = {
          type: 'resize',
          pointerId: event.pointerId,
          before: cloneScene(sceneRef.current),
          element: cloneElement(selectedElement),
        }
        return
      }
      const hit = topElementAt(sceneRef.current, point, 8 / viewportRef.current.zoom)
      if (!hit) {
        setSelectedId(null)
        return
      }
      if (event.detail >= 2 && (hit.type === 'text' || hit.type === 'sticky')) {
        startTextEditing(hit.type, point, hit)
        return
      }
      setSelectedId(hit.id)
      gestureRef.current = {
        type: 'move',
        pointerId: event.pointerId,
        start: point,
        before: cloneScene(sceneRef.current),
        element: cloneElement(hit),
      }
      return
    }

    if (tool === 'eraser') {
      gestureRef.current = { type: 'erase', pointerId: event.pointerId, before: cloneScene(sceneRef.current), changed: false }
      eraseAt(point)
      return
    }

    if (tool === 'pen' || tool === 'highlighter') {
      setLiveDraft({ type: 'stroke', tool, points: [point], color, size })
      gestureRef.current = { type: 'draw', pointerId: event.pointerId }
      return
    }

    if (tool === 'text' || tool === 'sticky') {
      startTextEditing(tool, point)
      return
    }

    if (tool === 'rectangle' || tool === 'ellipse' || tool === 'line' || tool === 'arrow') {
      const element: DrawingShapeElement = {
        id: crypto.randomUUID(),
        type: tool,
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        strokeColor: color,
        strokeWidth: size,
        opacity: 1,
      }
      setLiveDraft({ type: 'shape', element })
      gestureRef.current = { type: 'shape', pointerId: event.pointerId, start: point }
    }
  }

  function eraseAt(point: DrawingPoint) {
    const gesture = gestureRef.current
    if (gesture?.type !== 'erase') return
    const hit = topElementAt(sceneRef.current, point, 10 / viewportRef.current.zoom)
    if (!hit) return
    gesture.changed = true
    setLiveScene({ ...sceneRef.current, elements: sceneRef.current.elements.filter((element) => element.id !== hit.id) })
    if (selectedId === hit.id) setSelectedId(null)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    event.preventDefault()

    if (gesture.type === 'pan') {
      setLiveViewport({
        ...gesture.viewport,
        x: gesture.viewport.x + event.clientX - gesture.startX,
        y: gesture.viewport.y + event.clientY - gesture.startY,
      })
      return
    }

    const point = worldPoint(event.clientX, event.clientY, event.pressure)
    if (gesture.type === 'draw') {
      const current = draftRef.current
      if (current?.type !== 'stroke') return
      const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent]
      const additions = coalesced.map((item) => worldPoint(item.clientX, item.clientY, item.pressure))
      setLiveDraft({ ...current, points: [...current.points, ...additions] })
    } else if (gesture.type === 'shape') {
      const current = draftRef.current
      if (current?.type !== 'shape') return
      let width = point.x - gesture.start.x
      let height = point.y - gesture.start.y
      if (event.shiftKey) {
        const magnitude = Math.max(Math.abs(width), Math.abs(height))
        width = Math.sign(width || 1) * magnitude
        height = Math.sign(height || 1) * magnitude
      }
      setLiveDraft({ ...current, element: { ...current.element, width, height } })
    } else if (gesture.type === 'move') {
      const dx = point.x - gesture.start.x
      const dy = point.y - gesture.start.y
      setLiveScene({
        ...gesture.before,
        elements: gesture.before.elements.map((element) => element.id === gesture.element.id ? moveDrawingElement(gesture.element, dx, dy) : element),
      })
    } else if (gesture.type === 'resize') {
      const bounds = elementBounds(gesture.element)
      let width = point.x - bounds.x
      let height = point.y - bounds.y
      if (event.shiftKey) {
        const aspect = bounds.width / Math.max(1, bounds.height)
        if (Math.abs(width) > Math.abs(height * aspect)) height = width / aspect
        else width = height * aspect
      }
      setLiveScene({
        ...gesture.before,
        elements: gesture.before.elements.map((element) => element.id === gesture.element.id
          ? resizeElementFromBounds(gesture.element, width, height)
          : element),
      })
    } else if (gesture.type === 'erase') {
      eraseAt(point)
    }
  }

  function finishGesture(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null

    if (gesture.type === 'draw') {
      const current = draftRef.current
      setLiveDraft(null)
      if (current?.type === 'stroke' && current.points.length) {
        const element = normalizedStroke(current.tool, current.points, current.color, current.size)
        commitScene({ ...sceneRef.current, elements: [...sceneRef.current.elements, element] })
        setSelectedId(element.id)
      }
    } else if (gesture.type === 'shape') {
      const current = draftRef.current
      setLiveDraft(null)
      if (current?.type === 'shape' && (Math.abs(current.element.width) > 2 || Math.abs(current.element.height) > 2)) {
        let element = current.element
        if (element.type === 'rectangle' || element.type === 'ellipse') {
          const bounds = elementBounds(element)
          element = { ...element, ...bounds }
        }
        commitScene({ ...sceneRef.current, elements: [...sceneRef.current.elements, element] })
        setSelectedId(element.id)
      }
    } else if (gesture.type === 'move' || gesture.type === 'resize') {
      if (JSON.stringify(gesture.before) !== JSON.stringify(sceneRef.current)) commitScene(sceneRef.current)
    } else if (gesture.type === 'erase' && gesture.changed) {
      commitScene(sceneRef.current)
    }
  }

  function finishTextEditing() {
    if (!editing) return
    const element = sceneRef.current.elements.find((item) => item.id === editing.id)
    let next = sceneRef.current
    if (element && (element.type === 'text' || element.type === 'sticky') && !element.text.trim()) {
      next = { ...next, elements: next.elements.filter((item) => item.id !== editing.id) }
      setSelectedId(null)
    }
    setEditing(null)
    if (JSON.stringify(editing.before) !== JSON.stringify(next)) commitScene(next)
  }

  function updateEditingText(value: string) {
    if (!editing) return
    setLiveScene({
      ...sceneRef.current,
      elements: sceneRef.current.elements.map((element) => element.id === editing.id && (element.type === 'text' || element.type === 'sticky')
        ? { ...element, text: value }
        : element),
    })
  }

  function handleWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    event.preventDefault()
    const view = viewportRef.current
    if (event.ctrlKey || event.metaKey) {
      const screen = screenPoint(event.clientX, event.clientY)
      const worldX = (screen.x - view.x) / view.zoom
      const worldY = (screen.y - view.y) / view.zoom
      const zoom = clampZoom(view.zoom * Math.exp(-event.deltaY * 0.003))
      setLiveViewport({ x: screen.x - worldX * zoom, y: screen.y - worldY * zoom, zoom })
    } else {
      setLiveViewport({ ...view, x: view.x - event.deltaX, y: view.y - event.deltaY })
    }
  }

  function zoomBy(factor: number) {
    const view = viewportRef.current
    const centerX = canvasSize.width / 2
    const centerY = canvasSize.height / 2
    const worldX = (centerX - view.x) / view.zoom
    const worldY = (centerY - view.y) / view.zoom
    const zoom = clampZoom(view.zoom * factor)
    setLiveViewport({ x: centerX - worldX * zoom, y: centerY - worldY * zoom, zoom })
  }

  function fitToContent() {
    const bounds = sceneContentBounds(sceneRef.current)
    if (!bounds) {
      setLiveViewport(DEFAULT_VIEWPORT)
      return
    }
    const padding = 64
    const zoom = clampZoom(Math.min(
      (canvasSize.width - padding * 2) / bounds.width,
      (canvasSize.height - padding * 2) / bounds.height,
      1.5,
    ))
    setLiveViewport({
      x: (canvasSize.width - bounds.width * zoom) / 2 - bounds.x * zoom,
      y: (canvasSize.height - bounds.height * zoom) / 2 - bounds.y * zoom,
      zoom,
    })
  }

  function chooseColor(nextColor: string) {
    setColor(nextColor)
    if (!selectedId) return
    commitScene({
      ...sceneRef.current,
      elements: sceneRef.current.elements.map((element) => element.id === selectedId
        ? { ...element, strokeColor: nextColor }
        : element),
    })
  }

  function chooseSize(nextSize: number) {
    setSize(nextSize)
    if (!selectedId) return
    commitScene({
      ...sceneRef.current,
      elements: sceneRef.current.elements.map((element) => element.id === selectedId
        ? { ...element, strokeWidth: nextSize }
        : element),
    })
  }

  function duplicateSelected() {
    if (!selectedElement || selectedElement.type === 'image') return
    const duplicate = { ...cloneElement(selectedElement), id: crypto.randomUUID(), x: selectedElement.x + 24, y: selectedElement.y + 24 }
    commitScene({ ...sceneRef.current, elements: [...sceneRef.current.elements, duplicate] })
    setSelectedId(duplicate.id)
  }

  function moveSelectedLayer(direction: -1 | 1) {
    if (!selectedId) return
    const elements = [...sceneRef.current.elements]
    const index = elements.findIndex((element) => element.id === selectedId)
    const nextIndex = Math.min(elements.length - 1, Math.max(0, index + direction))
    if (index < 0 || index === nextIndex) return
    const [element] = elements.splice(index, 1)
    elements.splice(nextIndex, 0, element)
    commitScene({ ...sceneRef.current, elements })
  }

  function clearBoard() {
    if (scene.elements.length === 0) return
    if (!window.confirm('Clear this board? You can still undo it.')) return
    setSelectedId(null)
    commitScene({ ...sceneRef.current, elements: [] })
  }

  async function exportDrawing() {
    if (exporting) return
    setExporting(true)
    setExportStatus('Preparing drawing export…')

    try {
      const current = sceneRef.current
      const imageStatuses = await Promise.all(current.elements
        .filter((element) => element.type === 'image')
        .map((element) => waitForImageLoad(getDrawingImage(element.source))))
      const content = sceneContentBounds(current) ?? { x: 0, y: 0, width: 1200, height: 720 }
      const padding = 64
      const width = Math.max(320, content.width + padding * 2)
      const height = Math.max(240, content.height + padding * 2)
      const scale = Math.min(2, 4096 / Math.max(width, height))
      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = Math.ceil(width * scale)
      exportCanvas.height = Math.ceil(height * scale)
      const context = exportCanvas.getContext('2d')
      if (!context) throw new Error('Canvas export is unavailable.')
      context.setTransform(scale, 0, 0, scale, 0, 0)
      paintDrawingScene(
        context,
        current,
        { x: padding - content.x, y: padding - content.y, zoom: 1 },
        width,
        height,
        null,
        null,
        null,
      )
      downloadFile(exportCanvas.toDataURL('image/png'), `${safeDrawingFilename(noteTitle)}.png`)

      const unavailableImages = imageStatuses.filter((status) => status !== 'loaded').length
      setExportStatus(unavailableImages > 0
        ? `Exported without ${unavailableImages} unavailable legacy background ${unavailableImages === 1 ? 'image' : 'images'}.`
        : 'Drawing exported as PNG.')
    } catch {
      setExportStatus('Could not export this drawing. Try again or export a JSON backup.')
    } finally {
      setExporting(false)
    }
  }

  const editingElement = editing
    ? scene.elements.find((element): element is DrawingTextElement | DrawingStickyElement => (
      element.id === editing.id && (element.type === 'text' || element.type === 'sticky')
    ))
    : undefined

  const cursor = spacePanningRef.current || tool === 'hand'
    ? 'grab'
    : tool === 'select'
      ? 'default'
      : tool === 'text' || tool === 'sticky'
        ? 'text'
        : 'crosshair'
  const activeToolLabel = toolConfig.find((item) => item.tool === tool)?.label ?? tool

  if (initialParseRef.current.status === 'unsupported-version') {
    const version = initialParseRef.current.version
    const versionLabel = typeof version === 'number' || typeof version === 'string'
      ? String(version)
      : 'unknown'
    return (
      <section className="draw-editor" aria-label="Drawing editor">
        <div className="drawing-version-warning" role="alert">
          <AlertTriangle aria-hidden="true" size={22} />
          <div>
            <strong>Drawing update required</strong>
            <p>
              This drawing uses format version {versionLabel}, but this app supports version {DRAWING_SCENE_VERSION}.
              Your saved drawing is preserved, and editing is disabled until you open it in a compatible version.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="draw-editor" aria-label="Drawing editor">
      <div className="drawing-toolbar">
        <div className="tool-group drawing-tools" role="toolbar" aria-label="Drawing tools">
          {toolConfig.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.tool}
                className={tool === item.tool ? 'active' : ''}
                onClick={() => setTool(item.tool)}
                aria-pressed={tool === item.tool}
                aria-label={`${item.label} (${item.shortcut})`}
                title={`${item.label} (${item.shortcut})`}
              >
                <Icon size={17} />
                <span className="tool-label">{item.label}</span>
              </button>
            )
          })}
        </div>
        <div className="toolbar-divider" />
        <div className="drawing-properties">
          <div className="color-picker" role="group" aria-label="Ink color">
            {colors.map((item) => (
              <button
                key={item.value}
                className={color === item.value ? 'active' : ''}
                style={{ '--swatch': item.value } as React.CSSProperties}
                onClick={() => chooseColor(item.value)}
                aria-label={item.label}
                aria-pressed={color === item.value}
                title={item.label}
              />
            ))}
          </div>
          <label className="stroke-size" title="Stroke size">
            <span className="stroke-preview-slot"><span className="stroke-preview" style={{ width: Math.max(3, size), height: Math.max(3, size) }} /></span>
            <input type="range" min="2" max="14" value={size} onChange={(event) => chooseSize(Number(event.target.value))} aria-label="Stroke size" />
          </label>
          <label className="paper-select">
            <span>Paper</span>
            <select
              value={scene.paper}
              onChange={(event) => commitScene({ ...sceneRef.current, paper: event.target.value as DrawingPaper })}
              aria-label="Paper style"
            >
              <option value="dot">Dots</option>
              <option value="grid">Grid</option>
              <option value="lined">Lined</option>
              <option value="blank">Blank</option>
            </select>
          </label>
        </div>
        <div className="toolbar-spacer" />
        <div className="tool-group history-tools">
          <button onClick={() => moveHistory(-1)} disabled={historyIndex <= 0} aria-label="Undo" title="Undo (Mod+Z)"><Undo2 size={17} /></button>
          <button onClick={() => moveHistory(1)} disabled={historyIndex >= history.length - 1} aria-label="Redo" title="Redo (Mod+Shift+Z)"><Redo2 size={17} /></button>
          <button onClick={clearBoard} disabled={scene.elements.length === 0} aria-label="Clear board" title="Clear board"><Trash2 size={17} /></button>
          <button className="export-button" onClick={exportDrawing} disabled={exporting}>
            <Download size={16} />{exporting ? 'Preparing…' : 'Export'}
          </button>
        </div>
      </div>

      {selectedElement && selectedElement.type !== 'image' && (
        <div className="selection-toolbar" role="toolbar" aria-label="Selected object actions">
          <span>{selectedElement.type === 'highlighter' ? 'Highlight' : selectedElement.type.charAt(0).toUpperCase() + selectedElement.type.slice(1)} selected</span>
          <button onClick={duplicateSelected}><Copy size={15} />Duplicate</button>
          <button onClick={() => moveSelectedLayer(-1)} title="Send backward"><ArrowDown size={15} />Back</button>
          <button onClick={() => moveSelectedLayer(1)} title="Bring forward"><ArrowUp size={15} />Front</button>
          <button onClick={deleteSelected} className="danger-action"><Trash2 size={15} />Delete</button>
        </div>
      )}

      <div className="canvas-shell">
        <div className="canvas-corner-label"><Sparkles size={13} /> editable freeform space</div>
        <div className="canvas-frame" ref={frameRef}>
          <p id={keyboardInstructionsId} className="visually-hidden">
            Focus the canvas, then press V and Enter to select an object. Press Enter again to select the next object, or Shift Enter for the previous object. Use arrow keys to move the selected object and hold Shift to move ten pixels. Press a shape shortcut, then Enter, to create at the center. Press Delete to remove the selected object and Escape to clear the selection.
          </p>
          <div id={keyboardStatusId} className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
            {keyboardStatus}
          </div>
          <canvas
            ref={canvasRef}
            tabIndex={0}
            role="application"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishGesture}
            onPointerCancel={finishGesture}
            onLostPointerCapture={finishGesture}
            onKeyDown={handleCanvasKeyDown}
            onKeyUp={handleCanvasKeyUp}
            onBlur={() => {
              finishKeyboardMove()
              spacePanningRef.current = false
            }}
            onWheel={handleWheel}
            onContextMenu={(event) => event.preventDefault()}
            aria-label={`Editable drawing canvas. ${activeToolLabel} tool active.`}
            aria-describedby={`${keyboardInstructionsId} ${keyboardStatusId}`}
            aria-keyshortcuts="Enter Shift+Enter ArrowUp ArrowDown ArrowLeft ArrowRight Delete Backspace Escape V H P M E R O L A T S"
            style={{ cursor }}
          />
          {editingElement && (
            <textarea
              ref={textInputRef}
              className={`canvas-text-editor ${editingElement.type}`}
              value={editingElement.text}
              onChange={(event) => updateEditingText(event.target.value)}
              onBlur={finishTextEditing}
              onKeyDown={(event) => {
                if (event.key === 'Escape' || ((event.metaKey || event.ctrlKey) && event.key === 'Enter')) {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
              }}
              placeholder={editingElement.type === 'sticky' ? 'Write a note…' : 'Type something…'}
              aria-label={editingElement.type === 'sticky' ? 'Edit sticky note' : 'Edit canvas text'}
              style={{
                left: viewport.x + editingElement.x * viewport.zoom,
                top: viewport.y + editingElement.y * viewport.zoom,
                width: editingElement.width * viewport.zoom,
                height: editingElement.height * viewport.zoom,
                fontSize: editingElement.fontSize * viewport.zoom,
                color: editingElement.strokeColor,
                background: editingElement.type === 'sticky' ? editingElement.fillColor : 'transparent',
                padding: editingElement.type === 'sticky' ? 18 * viewport.zoom : 2,
              }}
            />
          )}
          <div className="canvas-zoom-controls" role="group" aria-label="Canvas zoom">
            <button onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out" title="Zoom out"><ZoomOut size={16} /></button>
            <button onClick={fitToContent} className="zoom-level" title="Fit content">{Math.round(viewport.zoom * 100)}%</button>
            <button onClick={() => zoomBy(1.2)} aria-label="Zoom in" title="Zoom in"><ZoomIn size={16} /></button>
            <button onClick={fitToContent} aria-label="Fit content" title="Fit content"><Maximize2 size={16} /></button>
          </div>
        </div>
      </div>
      <div className="drawing-tip" role="status" aria-live="polite" aria-atomic="true">
        {exportStatus
          ? <><Download size={14} />{exportStatus}</>
          : <><RotateCcw size={14} />Auto-saved · keyboard: V then Enter selects · arrows move · shape key then Enter creates</>}
      </div>
    </section>
  )
}
