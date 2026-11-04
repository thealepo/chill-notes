import { useEffect, useRef, useState } from 'react'
import type { DrawingScene } from '../lib/drawingScene'
import {
  paintDrawingScene,
  type DrawingDraft,
  type DrawingViewport,
} from '../lib/drawingRender'

export interface DrawingCanvasSize {
  width: number
  height: number
  ratio: number
}

interface UseDrawingCanvasRendererOptions {
  scene: DrawingScene
  viewport: DrawingViewport
  draft: DrawingDraft
  selectedId: string | null
  editingId: string | null
}

export function useDrawingCanvasRenderer({
  scene,
  viewport,
  draft,
  selectedId,
  editingId,
}: UseDrawingCanvasRendererOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState<DrawingCanvasSize>({ width: 1, height: 1, ratio: 1 })
  const [imageVersion, setImageVersion] = useState(0)

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
      editingId,
      () => setImageVersion((version) => version + 1),
    )
  }, [canvasSize, draft, editingId, imageVersion, scene, selectedId, viewport])

  return { canvasRef, frameRef, canvasSize }
}
