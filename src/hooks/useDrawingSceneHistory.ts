import { useCallback, useRef, useState } from 'react'
import { appendDrawingHistory, stepDrawingHistory } from '../lib/drawingHistory'
import { serializeDrawingScene, type DrawingScene } from '../lib/drawingScene'

interface UseDrawingSceneHistoryOptions {
  initialScene: DrawingScene
  onChange: (drawing: string) => void
}

function drawingStorageValue(scene: DrawingScene): string {
  return scene.elements.length === 0 && scene.paper === 'dot' ? '' : serializeDrawingScene(scene)
}

export function useDrawingSceneHistory({ initialScene, onChange }: UseDrawingSceneHistoryOptions) {
  const [scene, setScene] = useState(initialScene)
  const sceneRef = useRef(scene)
  const [history, setHistory] = useState<DrawingScene[]>([initialScene])
  const [historyIndex, setHistoryIndex] = useState(0)

  const setLiveScene = useCallback((next: DrawingScene) => {
    sceneRef.current = next
    setScene(next)
  }, [])

  const commitScene = useCallback((next: DrawingScene) => {
    setLiveScene(next)
    const update = appendDrawingHistory(history, historyIndex, next)
    setHistory(update.entries)
    setHistoryIndex(update.index)
    onChange(drawingStorageValue(next))
  }, [history, historyIndex, onChange, setLiveScene])

  const moveHistory = useCallback((direction: -1 | 1) => {
    const step = stepDrawingHistory(history, historyIndex, direction)
    if (!step) return false
    setHistoryIndex(step.index)
    setLiveScene(step.scene)
    onChange(drawingStorageValue(step.scene))
    return true
  }, [history, historyIndex, onChange, setLiveScene])

  return {
    scene,
    sceneRef,
    setLiveScene,
    commitScene,
    moveHistory,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
  }
}
