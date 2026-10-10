import { sceneContentBounds, type DrawingScene } from './drawingScene'
import { getDrawingImage, paintDrawingScene } from './drawingRender'
import { waitForImageLoad } from './imageLoading'
import { downloadFile } from './platform'

function safeDrawingFilename(title: string): string {
  return title.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'sketch'
}

export async function downloadDrawingScene(scene: DrawingScene, noteTitle: string): Promise<number> {
  const imageStatuses = await Promise.all(scene.elements
    .filter((element) => element.type === 'image')
    .map((element) => waitForImageLoad(getDrawingImage(element.source))))
  const content = sceneContentBounds(scene) ?? { x: 0, y: 0, width: 1200, height: 720 }
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
    scene,
    { x: padding - content.x, y: padding - content.y, zoom: 1 },
    width,
    height,
    null,
    null,
    null,
  )
  downloadFile(exportCanvas.toDataURL('image/png'), `${safeDrawingFilename(noteTitle)}.png`)
  return imageStatuses.filter((status) => status !== 'loaded').length
}
