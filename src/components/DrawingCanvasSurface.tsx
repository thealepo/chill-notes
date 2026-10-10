import { Sparkles } from 'lucide-react'
import type {
  CSSProperties,
  KeyboardEventHandler,
  PointerEventHandler,
  RefObject,
  WheelEventHandler,
} from 'react'
import type { DrawingStickyElement, DrawingTextElement } from '../lib/drawingScene'
import type { DrawingViewport } from '../lib/drawingRender'
import { DrawingZoomControls } from './DrawingControls'

interface DrawingCanvasSurfaceProps {
  frameRef: RefObject<HTMLDivElement>
  canvasRef: RefObject<HTMLCanvasElement>
  textInputRef: RefObject<HTMLTextAreaElement>
  keyboardInstructionsId: string
  keyboardStatusId: string
  keyboardStatus: string
  activeToolLabel: string
  cursor: CSSProperties['cursor']
  editingElement?: DrawingTextElement | DrawingStickyElement
  viewport: DrawingViewport
  onPointerDown: PointerEventHandler<HTMLCanvasElement>
  onPointerMove: PointerEventHandler<HTMLCanvasElement>
  onPointerFinish: PointerEventHandler<HTMLCanvasElement>
  onKeyDown: KeyboardEventHandler<HTMLCanvasElement>
  onKeyUp: KeyboardEventHandler<HTMLCanvasElement>
  onCanvasBlur: () => void
  onWheel: WheelEventHandler<HTMLCanvasElement>
  onUpdateEditingText: (value: string) => void
  onFinishTextEditing: () => void
  onZoom: (factor: number) => void
  onFit: () => void
}

export function DrawingCanvasSurface({
  frameRef,
  canvasRef,
  textInputRef,
  keyboardInstructionsId,
  keyboardStatusId,
  keyboardStatus,
  activeToolLabel,
  cursor,
  editingElement,
  viewport,
  onPointerDown,
  onPointerMove,
  onPointerFinish,
  onKeyDown,
  onKeyUp,
  onCanvasBlur,
  onWheel,
  onUpdateEditingText,
  onFinishTextEditing,
  onZoom,
  onFit,
}: DrawingCanvasSurfaceProps) {
  return (
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
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerFinish}
          onPointerCancel={onPointerFinish}
          onLostPointerCapture={onPointerFinish}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onBlur={onCanvasBlur}
          onWheel={onWheel}
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
            onChange={(event) => onUpdateEditingText(event.target.value)}
            onBlur={onFinishTextEditing}
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
        <DrawingZoomControls zoom={viewport.zoom} onZoom={onZoom} onFit={onFit} />
      </div>
    </div>
  )
}
