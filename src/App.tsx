import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ChevronDown,
  Command,
  Copy,
  Download,
  Feather,
  Heart,
  ImagePlus,
  Menu,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Settings,
  SmilePlus,
  Trash2,
  X,
} from 'lucide-react'
import { DrawingCanvas } from './components/DrawingCanvas'
import { NoteEditor } from './components/NoteEditor'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { starterNotes } from './data'
import { useTheme } from './hooks/useTheme'
import type { EditorMode, Note } from './types'

const STORAGE_KEY = 'chill-notes-v1'

type NoteView = 'notes' | 'archive'
type SortOrder = 'updated' | 'title'

function readNotes() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return starterNotes
    const parsed = JSON.parse(saved) as Note[]
    return parsed.map((note) => ({
      ...note,
      blocks: note.blocks.map((block) => ({
        ...block,
        kind: (block.kind as string) === 'heading' ? 'heading2' : block.kind,
      })),
    }))
  } catch {
    return starterNotes
  }
}

function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days}d ago`
}

function blankNote(): Note {
  return {
    id: crypto.randomUUID(),
    title: '',
    favorite: false,
    updatedAt: Date.now(),
    blocks: [{ id: crypto.randomUUID(), kind: 'text', content: '' }],
  }
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>(readNotes)
  const [activeId, setActiveId] = useState(() => readNotes()[0]?.id ?? '')
  const [mode, setMode] = useState<EditorMode>(() =>
    new URLSearchParams(window.location.search).get('mode') === 'draw' ? 'draw' : 'type',
  )
  const [view, setView] = useState<NoteView>('notes')
  const [sortOrder, setSortOrder] = useState<SortOrder>('updated')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [noteMenuOpen, setNoteMenuOpen] = useState(false)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const { preference: themePreference, setPreference: setThemePreference } = useTheme()

  const activeNote = notes.find((note) => note.id === activeId) ?? notes[0]
  const visibleNotes = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return notes
      .filter((note) => {
        if (Boolean(note.archived) !== (view === 'archive')) return false
        if (!normalized) return true
        const body = note.blocks.map((block) => block.content).join(' ')
        return `${note.title} ${body}`.toLowerCase().includes(normalized)
      })
      .sort((a, b) => sortOrder === 'title'
        ? (a.title || 'Untitled note').localeCompare(b.title || 'Untitled note')
        : b.updatedAt - a.updatedAt)
  }, [notes, query, sortOrder, view])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 2400)
    return () => window.clearTimeout(timeout)
  }, [notice])

  function updateNote(updated: Note) {
    setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)))
  }

  function createNote() {
    const note = blankNote()
    setNotes((current) => [note, ...current])
    setActiveId(note.id)
    setView('notes')
    setMode('type')
    setSidebarOpen(false)
    setNoteMenuOpen(false)
    requestAnimationFrame(() => titleInputRef.current?.focus())
  }

  function selectNote(id: string) {
    setActiveId(id)
    setSidebarOpen(false)
    setNoteMenuOpen(false)
  }

  function showView(nextView: NoteView) {
    const nextNote = notes.find((note) => Boolean(note.archived) === (nextView === 'archive'))
    if (!nextNote && nextView === 'archive') {
      setNotice('Archive is empty.')
      setSidebarOpen(false)
      return
    }
    setView(nextView)
    setQuery('')
    setSettingsOpen(false)
    setWorkspaceMenuOpen(false)
    setSidebarOpen(false)
    setNotice('')
    if (nextNote) setActiveId(nextNote.id)
  }

  function toggleFavorite() {
    if (!activeNote) return
    updateNote({ ...activeNote, favorite: !activeNote.favorite, updatedAt: Date.now() })
  }

  function duplicateActiveNote() {
    if (!activeNote) return
    const duplicate: Note = {
      ...activeNote,
      id: crypto.randomUUID(),
      title: activeNote.title ? `${activeNote.title} copy` : 'Untitled note copy',
      updatedAt: Date.now(),
      blocks: activeNote.blocks.map((block) => ({ ...block, id: crypto.randomUUID() })),
    }
    setNotes((current) => [duplicate, ...current])
    setActiveId(duplicate.id)
    setNoteMenuOpen(false)
  }

  function toggleArchive() {
    if (!activeNote) return
    const archived = !activeNote.archived
    const updated = { ...activeNote, archived, updatedAt: Date.now() }
    const nextInView = notes.find((note) => note.id !== activeNote.id && Boolean(note.archived) === (view === 'archive'))
    updateNote(updated)
    setNoteMenuOpen(false)

    if (!archived) {
      setView('notes')
      return
    }
    if (nextInView) {
      setActiveId(nextInView.id)
      return
    }
    const note = blankNote()
    setNotes((current) => [note, ...current])
    setActiveId(note.id)
    setView('notes')
  }

  function deleteActiveNote() {
    if (!activeNote || !window.confirm('Delete this note? This cannot be undone.')) return
    const remaining = notes.filter((note) => note.id !== activeNote.id)
    let nextNote = remaining.find((note) => Boolean(note.archived) === (view === 'archive'))

    if (!nextNote && view === 'archive') {
      setView('notes')
      nextNote = remaining.find((note) => !note.archived)
    }
    if (!nextNote) {
      nextNote = blankNote()
      remaining.unshift(nextNote)
      setView('notes')
    }

    setNotes(remaining)
    setActiveId(nextNote.id)
    setNoteMenuOpen(false)
  }

  function exportNotes() {
    const file = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `chill-notes-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setWorkspaceMenuOpen(false)
  }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = target?.matches('input, textarea, [contenteditable="true"]') ?? false
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }
      if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        const note = blankNote()
        setNotes((current) => [note, ...current])
        setActiveId(note.id)
        setView('notes')
        setMode('type')
        requestAnimationFrame(() => titleInputRef.current?.focus())
      }
      if (event.key === 'Escape') {
        setNoteMenuOpen(false)
        setWorkspaceMenuOpen(false)
        setSettingsOpen(false)
        setSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  if (!activeNote) return null

  return (
    <div className={`app-shell ${focusMode ? 'focus-mode' : ''}`}>
      <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open notes">
        <Menu size={20} />
      </button>
      {notice && <div className="toast" role="status">{notice}</div>}

      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Feather size={18} strokeWidth={1.8} /></div>
          <span className="brand-name">chill notes</span>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close notes">
            <X size={18} />
          </button>
        </div>

        <button className="new-note-button" onClick={createNote}>
          <Plus size={17} />
          New note
          <span className="key-hint">N</span>
        </button>

        <label className="search-field">
          <Search size={16} />
          <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your notes" />
          <span className="key-hint">⌘ K</span>
        </label>

        <div className="sidebar-section-label">
          <span>
            {view === 'archive' ? 'Archive' : 'Notes'}
            <span className="note-count">{visibleNotes.length}</span>
          </span>
          <button
            className={`bare-button sort-button ${sortOrder === 'title' ? 'alphabetical' : ''}`}
            onClick={() => setSortOrder((current) => current === 'updated' ? 'title' : 'updated')}
            aria-pressed={sortOrder === 'title'}
            aria-label={`Sort notes by ${sortOrder === 'updated' ? 'title' : 'last updated'}`}
            title={`Sorted by ${sortOrder === 'updated' ? 'last updated' : 'title'}`}
          >
            <ChevronDown size={15} />
          </button>
        </div>

        <nav className="notes-list" aria-label="Notes">
          {visibleNotes.map((note) => (
            <button
              key={note.id}
              className={`note-item ${note.id === activeNote.id ? 'active' : ''}`}
              onClick={() => selectNote(note.id)}
            >
              <span className="note-icon">{note.favorite ? '✦' : '◌'}</span>
              <span className="note-details">
                <span className="note-title">{note.title || 'Untitled note'}</span>
                <span className="note-meta">{relativeTime(note.updatedAt)}</span>
              </span>
            </button>
          ))}
          {visibleNotes.length === 0 && (
            <div className="empty-search">{view === 'archive' ? 'Archive is empty.' : 'No notes found.'}</div>
          )}
        </nav>

        <div className="sidebar-footer">
          <button
            className={`sidebar-link ${view === 'archive' ? 'active' : ''}`}
            onClick={() => showView(view === 'archive' ? 'notes' : 'archive')}
          >
            {view === 'archive' ? <RotateCcw size={17} /> : <Archive size={17} />}
            {view === 'archive' ? 'Back to notes' : 'Archive'}
          </button>

          <div className="sidebar-control">
            <button
              className={`sidebar-link ${settingsOpen ? 'active' : ''}`}
              onClick={() => { setSettingsOpen((current) => !current); setWorkspaceMenuOpen(false) }}
              aria-expanded={settingsOpen}
            >
              <Settings size={17} />Settings
            </button>
            {settingsOpen && (
              <div className="settings-panel" role="dialog" aria-label="Settings">
                <div className="panel-heading">
                  <strong>Settings</strong>
                  <button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={15} /></button>
                </div>
                <ThemeSwitcher value={themePreference} onChange={setThemePreference} />
              </div>
            )}
          </div>

          <div className="profile-card">
            <div className="avatar">AS</div>
            <div><strong>Alex's space</strong><span>Saved locally</span></div>
            <button
              className="icon-button profile-menu-button"
              onClick={() => { setWorkspaceMenuOpen((current) => !current); setSettingsOpen(false) }}
              aria-label="Workspace options"
              aria-expanded={workspaceMenuOpen}
            >
              <MoreHorizontal size={17} />
            </button>
            {workspaceMenuOpen && (
              <div className="workspace-menu" role="menu">
                <button onClick={exportNotes} role="menuitem"><Download size={15} />Export all notes</button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />}

      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{activeNote.archived ? 'Archive' : 'Notes'}</span><span>/</span><strong>{activeNote.title || 'Untitled note'}</strong>
          </div>
          <div className="topbar-mode-switcher" role="tablist" aria-label="Note mode">
            <button className={mode === 'type' ? 'active' : ''} onClick={() => setMode('type')} role="tab" aria-selected={mode === 'type'}>
              <Command size={15} />Type
            </button>
            <button className={mode === 'draw' ? 'active' : ''} onClick={() => setMode('draw')} role="tab" aria-selected={mode === 'draw'}>
              <Feather size={15} />Draw
            </button>
          </div>
          <div className="topbar-actions">
            <span className="save-state" role="status"><span className="save-dot" />Saved</span>
            <button className="focus-button topbar-focus" onClick={() => setFocusMode((current) => !current)}>
              {focusMode ? 'Leave focus' : 'Focus'}
            </button>
            <button className={`icon-button ${activeNote.favorite ? 'favorite' : ''}`} onClick={toggleFavorite} aria-label={activeNote.favorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={activeNote.favorite}>
              <Heart size={18} fill={activeNote.favorite ? 'currentColor' : 'none'} />
            </button>
            <button className="icon-button" onClick={() => setNoteMenuOpen((current) => !current)} aria-label="Note options" aria-expanded={noteMenuOpen}>
              <MoreHorizontal size={20} />
            </button>
            {noteMenuOpen && (
              <div className="note-menu" role="menu">
                <button onClick={duplicateActiveNote} role="menuitem"><Copy size={15} />Duplicate</button>
                <button onClick={toggleArchive} role="menuitem">
                  {activeNote.archived ? <RotateCcw size={15} /> : <Archive size={15} />}
                  {activeNote.archived ? 'Restore' : 'Archive'}
                </button>
                <button className="danger" onClick={deleteActiveNote} role="menuitem"><Trash2 size={15} />Delete</button>
              </div>
            )}
          </div>
        </header>

        <div className="workspace-scroll">
          <div className={`note-page mode-${mode}`}>
            {activeNote.hasCover && (
              <div className="page-cover" aria-label="Page cover">
                <button onClick={() => updateNote({ ...activeNote, hasCover: false, updatedAt: Date.now() })}><X size={14} />Remove cover</button>
              </div>
            )}

            <div className="document-column">
              {activeNote.pageIcon && (
                <button className="page-icon" onClick={() => updateNote({ ...activeNote, pageIcon: undefined, updatedAt: Date.now() })} title="Remove icon" aria-label="Remove page icon">
                  {activeNote.pageIcon}
                </button>
              )}

              <div className="page-customize-actions">
                {!activeNote.pageIcon && (
                  <button onClick={() => updateNote({ ...activeNote, pageIcon: '🌸', updatedAt: Date.now() })}><SmilePlus size={14} />Add icon</button>
                )}
                {!activeNote.hasCover && (
                  <button onClick={() => updateNote({ ...activeNote, hasCover: true, updatedAt: Date.now() })}><ImagePlus size={14} />Add cover</button>
                )}
              </div>

              <input
                ref={titleInputRef}
                className="title-input"
                value={activeNote.title}
                onChange={(event) => updateNote({ ...activeNote, title: event.target.value, updatedAt: Date.now() })}
                aria-label="Note title"
                placeholder="Untitled"
              />

              {mode === 'type' ? (
                <NoteEditor note={activeNote} onChange={updateNote} />
              ) : (
                <DrawingCanvas
                  key={activeNote.id}
                  initialDrawing={activeNote.drawing}
                  onChange={(drawing) => updateNote({ ...activeNote, drawing, updatedAt: Date.now() })}
                  noteTitle={activeNote.title}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
