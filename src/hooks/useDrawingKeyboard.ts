import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react'
import { drawingTools } from '../components/drawingControlsConfig'
import {
  createKeyboardElement,
  drawingElementLabel,
  isKeyboardCreatableTool,
  moveDrawingElement,
  nextEditableElement,
} from '../lib/drawingKeyboard'
import type { DrawingCanvasSize } from './useDrawingCanvasRenderer'
import type { DrawingScene } from '../lib/drawingScene'
import { clampDrawingZoom } from '../lib/drawingViewport'
import type { DrawingViewport } from '../lib/drawingRender'
import type { DrawingTool } from '../types'

export interface DrawingTextEditingState {
  id: string
  before: DrawingScene
}

interface UseDrawingKeyboardOptions {
  tool: DrawingTool
  color: string
  size: number
  canvasSize: DrawingCanvasSize
  canvasRef: RefObject<HTMLCanvasElement | null>
  sceneRef: MutableRefObject<DrawingScene>
  viewportRef: MutableRefObject<DrawingViewport>
  selectedId: string | null
  setTool: Dispatch<SetStateAction<DrawingTool>>
  setSelectedId: Dispatch<SetStateAction<string | null>>
  setEditing: Dispatch<SetStateAction<DrawingTextEditingState | null>>
  setLiveScene: (scene: DrawingScene) => void
  commitScene: (scene: DrawingScene) => void
  setLiveViewport: (viewport: DrawingViewport) => void
  moveHistory: (direction: -1 | 1) => void
  deleteSelected: () => void
}

export function useDrawingKeyboard({
  tool,
  color,
  size,
  canvasSize,
  canvasRef,
  sceneRef,
  viewportRef,
  selectedId,
  setTool,
  setSelectedId,
  setEditing,
  setLiveScene,
  commitScene,
  setLiveViewport,
  moveHistory,
  deleteSelected,
}: UseDrawingKeyboardOptions) {
  const [keyboardStatus, setKeyboardStatus] = useState('')
  const keyboardInstructionsId = useId()
  const keyboardStatusId = useId()
  const keyboardMoveRef = useRef<string | null>(null)
  const announcementFrameRef = useRef<number | null>(null)
  const spacePanningRef = useRef(false)

  const announce = useCallback((message: string) => {
    if (announcementFrameRef.current !== null) cancelAnimationFrame(announcementFrameRef.current)
    setKeyboardStatus('')
    announcementFrameRef.current = requestAnimationFrame(() => {
      setKeyboardStatus(message)
      announcementFrameRef.current = null
    })
  }, [])

  const finishKeyboardMove = useCallback(() => {
    if (!keyboardMoveRef.current) return
    keyboardMoveRef.current = null
    commitScene(sceneRef.current)
  }, [commitScene, sceneRef])

  useEffect(() => () => {
    if (announcementFrameRef.current !== null) cancelAnimationFrame(announcementFrameRef.current)
  }, [])

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
      const shortcut = drawingTools.find((item) => item.shortcut.toLowerCase() === event.key.toLowerCase())
      if (shortcut && !event.metaKey && !event.ctrlKey && !event.altKey) setTool(shortcut.tool)
      if ((event.key === '+' || event.key === '=') && !event.metaKey && !event.ctrlKey) {
        setLiveViewport({ ...viewportRef.current, zoom: clampDrawingZoom(viewportRef.current.zoom * 1.15) })
      }
      if (event.key === '-' && !event.metaKey && !event.ctrlKey) {
        setLiveViewport({ ...viewportRef.current, zoom: clampDrawingZoom(viewportRef.current.zoom / 1.15) })
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
  }, [canvasRef, deleteSelected, moveHistory, selectedId, setLiveViewport, setTool, viewportRef])

  function visibleCanvasCenter() {
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

    const before = structuredClone(sceneRef.current)
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

  function handleCanvasKeyDown(event: ReactKeyboardEvent<HTMLCanvasElement>) {
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
      const selected = sceneRef.current.elements.find((element) => element.id === selectedId)
      if (!selected || selected.type === 'image') return
      event.preventDefault()
      event.stopPropagation()
      const label = drawingElementLabel(selected)
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

  function handleCanvasKeyUp(event: ReactKeyboardEvent<HTMLCanvasElement>) {
    if (event.key.startsWith('Arrow')) finishKeyboardMove()
  }

  return {
    keyboardInstructionsId,
    keyboardStatusId,
    keyboardStatus,
    spacePanningRef,
    finishKeyboardMove,
    handleCanvasKeyDown,
    handleCanvasKeyUp,
  }
}
