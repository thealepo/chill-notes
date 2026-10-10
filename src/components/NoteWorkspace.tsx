import {
  AlertCircle,
  Archive,
  Command,
  Copy,
  Feather,
  FileText,
  Heart,
  ImagePlus,
  MoreHorizontal,
  RotateCcw,
  SmilePlus,
  Trash2,
  X,
} from 'lucide-react'
import type { RefObject } from 'react'
import type { WorkspaceSavePhase } from '../hooks/useWorkspaceStorage'
import type { EditorMode, Note } from '../types'
import { DrawingCanvas } from './DrawingCanvas'
import { NoteEditor } from './NoteEditor'

interface NoteWorkspaceProps {
  note: Note
  mode: EditorMode
  saveStatus: WorkspaceSavePhase
  focusMode: boolean
  noteMenuOpen: boolean
  titleInputRef: RefObject<HTMLTextAreaElement>
  onModeChange: (mode: EditorMode) => void
  onToggleFocus: () => void
  onToggleFavorite: () => void
  onToggleNoteMenu: () => void
  onExportMarkdown: () => void
  onDuplicate: () => void
  onToggleArchive: () => void
  onDelete: () => void
  onUpdateNote: (note: Note) => void
}

function focusFirstBlock() {
  document.querySelector<HTMLTextAreaElement>('.notion-editor .block-content textarea')?.focus()
}

export function NoteWorkspace({
  note,
  mode,
  saveStatus,
  focusMode,
  noteMenuOpen,
  titleInputRef,
  onModeChange,
  onToggleFocus,
  onToggleFavorite,
  onToggleNoteMenu,
  onExportMarkdown,
  onDuplicate,
  onToggleArchive,
  onDelete,
  onUpdateNote,
}: NoteWorkspaceProps) {
  const saveFailed = saveStatus === 'error'
  const saveWarning = saveStatus === 'warning'
  const saveLabel = saveStatus === 'loading'
    ? 'Loading'
    : saveStatus === 'saving'
      ? 'Saving…'
      : saveFailed
        ? 'Not saved'
        : saveWarning
          ? 'Saved (limited)'
          : 'Saved'

  return (
    <main className="workspace">
      <header className="topbar">
        <div className="breadcrumb">
          <span>{note.archived ? 'Archive' : 'Notes'}</span><span>/</span><strong>{note.title || 'Untitled note'}</strong>
        </div>
        <div className="topbar-mode-switcher" role="tablist" aria-label="Note mode">
          <button className={mode === 'type' ? 'active' : ''} onClick={() => onModeChange('type')} role="tab" aria-selected={mode === 'type'}>
            <Command size={15} />Type
          </button>
          <button className={mode === 'draw' ? 'active' : ''} onClick={() => onModeChange('draw')} role="tab" aria-selected={mode === 'draw'}>
            <Feather size={15} />Draw
          </button>
        </div>
        <div className="topbar-actions">
          <span className={`save-state ${saveFailed ? 'is-error' : saveWarning ? 'is-warning' : ''}`} role="status">
            {saveFailed || saveWarning ? <AlertCircle size={13} /> : <span className="save-dot" />}
            {saveLabel}
          </span>
          <button className="focus-button topbar-focus" onClick={onToggleFocus} aria-pressed={focusMode}>
            {focusMode ? 'Leave focus' : 'Focus'}
          </button>
          <button className={`icon-button ${note.favorite ? 'favorite' : ''}`} onClick={onToggleFavorite} aria-label={note.favorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={note.favorite}>
            <Heart size={18} fill={note.favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            className={`icon-button ${noteMenuOpen ? 'is-open' : ''}`}
            onClick={onToggleNoteMenu}
            aria-label="Note options"
            aria-expanded={noteMenuOpen}
            data-menu-trigger
          >
            <MoreHorizontal size={20} />
          </button>
          {noteMenuOpen && (
            <div className="note-menu" role="menu">
              <button onClick={onExportMarkdown} role="menuitem"><FileText size={15} />Export as Markdown</button>
              <button onClick={onDuplicate} role="menuitem"><Copy size={15} />Duplicate</button>
              <button onClick={onToggleArchive} role="menuitem">
                {note.archived ? <RotateCcw size={15} /> : <Archive size={15} />}
                {note.archived ? 'Restore' : 'Archive'}
              </button>
              <button className="danger" onClick={onDelete} role="menuitem"><Trash2 size={15} />Delete</button>
            </div>
          )}
        </div>
      </header>

      <div className="workspace-scroll">
        <div className={`note-page mode-${mode}`}>
          {note.hasCover && (
            <div className="page-cover" aria-label="Page cover">
              <button onClick={() => onUpdateNote({ ...note, hasCover: false, updatedAt: Date.now() })}><X size={14} />Remove cover</button>
            </div>
          )}

          <div className="document-column">
            {note.pageIcon && (
              <button className="page-icon" onClick={() => onUpdateNote({ ...note, pageIcon: undefined, updatedAt: Date.now() })} title="Remove icon" aria-label="Remove page icon">
                {note.pageIcon}
              </button>
            )}

            <div className="page-customize-actions">
              {!note.pageIcon && (
                <button onClick={() => onUpdateNote({ ...note, pageIcon: '🌸', updatedAt: Date.now() })}><SmilePlus size={14} />Add icon</button>
              )}
              {!note.hasCover && (
                <button onClick={() => onUpdateNote({ ...note, hasCover: true, updatedAt: Date.now() })}><ImagePlus size={14} />Add cover</button>
              )}
            </div>

            <textarea
              ref={titleInputRef}
              className="title-input"
              rows={1}
              value={note.title}
              onChange={(event) => onUpdateNote({ ...note, title: event.target.value.replace(/\r?\n/g, ' '), updatedAt: Date.now() })}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                event.preventDefault()
                if (mode === 'type') focusFirstBlock()
              }}
              aria-label="Note title"
              placeholder="Untitled"
            />

            {mode === 'type' ? (
              <NoteEditor key={note.id} note={note} onChange={onUpdateNote} />
            ) : (
              <DrawingCanvas
                key={note.id}
                initialDrawing={note.drawing}
                onChange={(drawing) => onUpdateNote({ ...note, drawing, updatedAt: Date.now() })}
                noteTitle={note.title}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
