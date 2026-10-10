import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Maximize2,
  Redo2,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import type { DrawingElement, DrawingPaper } from '../lib/drawingScene'
import type { DrawingTool } from '../types'
import { drawingColors, drawingTools } from './drawingControlsConfig'

interface DrawingToolbarProps {
  tool: DrawingTool
  color: string
  size: number
  paper: DrawingPaper
  canUndo: boolean
  canRedo: boolean
  hasElements: boolean
  exporting: boolean
  onToolChange: (tool: DrawingTool) => void
  onColorChange: (color: string) => void
  onSizeChange: (size: number) => void
  onPaperChange: (paper: DrawingPaper) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onExport: () => void
}

export function DrawingToolbar({
  tool,
  color,
  size,
  paper,
  canUndo,
  canRedo,
  hasElements,
  exporting,
  onToolChange,
  onColorChange,
  onSizeChange,
  onPaperChange,
  onUndo,
  onRedo,
  onClear,
  onExport,
}: DrawingToolbarProps) {
  return (
    <div className="drawing-toolbar">
      <div className="tool-group drawing-tools" role="toolbar" aria-label="Drawing tools">
        {drawingTools.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.tool}
              className={tool === item.tool ? 'active' : ''}
              onClick={() => onToolChange(item.tool)}
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
          {drawingColors.map((item) => (
            <button
              key={item.value}
              className={color === item.value ? 'active' : ''}
              style={{ '--swatch': item.value } as CSSProperties}
              onClick={() => onColorChange(item.value)}
              aria-label={item.label}
              aria-pressed={color === item.value}
              title={item.label}
            />
          ))}
        </div>
        <label className="stroke-size" title="Stroke size">
          <span className="stroke-preview-slot"><span className="stroke-preview" style={{ width: Math.max(3, size), height: Math.max(3, size) }} /></span>
          <input type="range" min="2" max="14" value={size} onChange={(event) => onSizeChange(Number(event.target.value))} aria-label="Stroke size" />
        </label>
        <label className="paper-select">
          <span>Paper</span>
          <select value={paper} onChange={(event) => onPaperChange(event.target.value as DrawingPaper)} aria-label="Paper style">
            <option value="dot">Dots</option>
            <option value="grid">Grid</option>
            <option value="lined">Lined</option>
            <option value="blank">Blank</option>
          </select>
        </label>
      </div>
      <div className="toolbar-spacer" />
      <div className="tool-group history-tools">
        <button onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo (Mod+Z)"><Undo2 size={17} /></button>
        <button onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo (Mod+Shift+Z)"><Redo2 size={17} /></button>
        <button onClick={onClear} disabled={!hasElements} aria-label="Clear board" title="Clear board"><Trash2 size={17} /></button>
        <button className="export-button" onClick={onExport} disabled={exporting}>
          <Download size={16} />{exporting ? 'Preparing…' : 'Export'}
        </button>
      </div>
    </div>
  )
}

interface DrawingSelectionToolbarProps {
  element: DrawingElement
  onDuplicate: () => void
  onMoveLayer: (direction: -1 | 1) => void
  onDelete: () => void
}

export function DrawingSelectionToolbar({ element, onDuplicate, onMoveLayer, onDelete }: DrawingSelectionToolbarProps) {
  const label = element.type === 'highlighter'
    ? 'Highlight'
    : element.type.charAt(0).toUpperCase() + element.type.slice(1)

  return (
    <div className="selection-toolbar" role="toolbar" aria-label="Selected object actions">
      <span>{label} selected</span>
      <button onClick={onDuplicate}><Copy size={15} />Duplicate</button>
      <button onClick={() => onMoveLayer(-1)} title="Send backward"><ArrowDown size={15} />Back</button>
      <button onClick={() => onMoveLayer(1)} title="Bring forward"><ArrowUp size={15} />Front</button>
      <button onClick={onDelete} className="danger-action"><Trash2 size={15} />Delete</button>
    </div>
  )
}

interface DrawingZoomControlsProps {
  zoom: number
  onZoom: (factor: number) => void
  onFit: () => void
}

export function DrawingZoomControls({ zoom, onZoom, onFit }: DrawingZoomControlsProps) {
  return (
    <div className="canvas-zoom-controls" role="group" aria-label="Canvas zoom">
      <button onClick={() => onZoom(1 / 1.2)} aria-label="Zoom out" title="Zoom out"><ZoomOut size={16} /></button>
      <button onClick={onFit} className="zoom-level" title="Fit content">{Math.round(zoom * 100)}%</button>
      <button onClick={() => onZoom(1.2)} aria-label="Zoom in" title="Zoom in"><ZoomIn size={16} /></button>
      <button onClick={onFit} aria-label="Fit content" title="Fit content"><Maximize2 size={16} /></button>
    </div>
  )
}
