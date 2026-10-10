import type { DrawingImageElement, DrawingScene } from './drawingScene'
import { createDrawingExportPlan } from './drawingExportPlan'
import { getDrawingImage, paintDrawingScene } from './drawingRender'
import { waitForImageLoad } from './imageLoading'
import { downloadFile } from './platform'

function safeDrawingFilename(title: string): string {
  return title.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'sketch'
}

export async function downloadDrawingScene(scene: DrawingScene, noteTitle: string): Promise<number> {
  const imageElements = scene.elements.filter((element): element is DrawingImageElement => element.type === 'image')
  const imageStatuses = await Promise.all(imageElements.map(async (element) => ({
    id: element.id,
    status: await waitForImageLoad(getDrawingImage(element.source)),
  })))
  const unavailableImageIds = new Set(imageStatuses
    .filter(({ status }) => status !== 'loaded')
    .map(({ id }) => id))
  const plan = createDrawingExportPlan(scene, unavailableImageIds)
  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = plan.pixelWidth
  exportCanvas.height = plan.pixelHeight
  const context = exportCanvas.getContext('2d')
  if (!context) throw new Error('Canvas export is unavailable.')
  context.setTransform(plan.scale, 0, 0, plan.scale, 0, 0)
  paintDrawingScene(
    context,
    plan.scene,
    plan.viewport,
    plan.width,
    plan.height,
    null,
    null,
    null,
  )
  downloadFile(exportCanvas.toDataURL('image/png'), `${safeDrawingFilename(noteTitle)}.png`)
  return plan.unavailableImageCount
}
