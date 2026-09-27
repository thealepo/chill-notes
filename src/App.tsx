import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ChevronDown,
  Command,
  Feather,
  Heart,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sparkles,
  X,
} from 'lucide-react'
import { DrawingCanvas } from './components/DrawingCanvas'
import { NoteEditor } from './components/NoteEditor'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { starterNotes } from './data'
import { useTheme } from './hooks/useTheme'
import type { EditorMode, Note } from './types'

const STORAGE_KEY = 'chill-notes-v1'

function readNotes() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as Note[]) : starterNotes
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

export default function App() {
  const [notes, setNotes] = useState<Note[]>(readNotes)
  const [activeId, setActiveId] = useState(() => readNotes()[0]?.id ?? '')
  const [mode, setMode] = useState<EditorMode>(() =>
    new URLSearchParams(window.location.search).get('mode') === 'draw' ? 'draw' : 'type',
  )
  const [query, setQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const { preference: themePreference, setPreference: setThemePreference } = useTheme()

  const activeNote = notes.find((note) => note.id === activeId) ?? notes[0]
  const visibleNotes = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return notes
      .filter((note) => {
        if (!normalized) return true
        const body = note.blocks.map((block) => block.content).join(' ')
        return `${note.title} ${body}`.toLowerCase().includes(normalized)
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [notes, query])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes])

  function updateNote(updated: Note) {
    setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)))
  }

  function createNote() {
    const id = crypto.randomUUID()
    const note: Note = {
      id,
      title: 'Untitled note',
      favorite: false,
      updatedAt: Date.now(),
      blocks: [{ id: crypto.randomUUID(), kind: 'text', content: '' }],
    }
    setNotes((current) => [note, ...current])
    setActiveId(id)
    setMode('type')
    setSidebarOpen(false)
  }

  function selectNote(id: string) {
    setActiveId(id)
    setSidebarOpen(false)
  }

  function toggleFavorite() {
    if (!activeNote) return
    updateNote({ ...activeNote, favorite: !activeNote.favorite, updatedAt: Date.now() })
  }

  if (!activeNote) return null

  return (
    <div className={`app-shell ${focusMode ? 'focus-mode' : ''}`}>
      <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open notes">
        <Menu size={20} />
      </button>

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
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your notes" />
          <span className="key-hint">⌘ K</span>
        </label>

        <div className="sidebar-section-label">
          <span>Your notes</span>
          <button className="bare-button" aria-label="Sort notes"><ChevronDown size={15} /></button>
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
            <div className="empty-search">No quiet thoughts found.</div>
          )}
        </nav>

        <div className="sidebar-footer">
          <ThemeSwitcher value={themePreference} onChange={setThemePreference} />
          <button className="sidebar-link"><Archive size={17} />Archive</button>
          <button className="sidebar-link"><Settings size={17} />Settings</button>
          <div className="profile-card">
            <div className="avatar">AS</div>
            <div><strong>Alex's space</strong><span>All changes saved</span></div>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />}

      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>My notes</span><span>/</span><strong>{activeNote.title || 'Untitled note'}</strong>
          </div>
          <div className="topbar-actions">
            <span className="save-state"><span className="save-dot" />Saved</span>
            <button className={`icon-button ${activeNote.favorite ? 'favorite' : ''}`} onClick={toggleFavorite} aria-label="Favorite note">
              <Heart size={18} fill={activeNote.favorite ? 'currentColor' : 'none'} />
            </button>
            <button className="icon-button" aria-label="More options"><MoreHorizontal size={20} /></button>
          </div>
        </header>

        <div className="workspace-scroll">
          <div className="note-page">
            <div className="note-kicker"><Sparkles size={14} /> a quiet place for your thoughts</div>
            <input
              className="title-input"
              value={activeNote.title}
              onChange={(event) => updateNote({ ...activeNote, title: event.target.value, updatedAt: Date.now() })}
              aria-label="Note title"
              placeholder="Untitled note"
            />

            <div className="mode-row">
              <div className="mode-switcher" role="tablist" aria-label="Note mode">
                <button className={mode === 'type' ? 'active' : ''} onClick={() => setMode('type')} role="tab">
                  <Command size={16} />Type
                </button>
                <button className={mode === 'draw' ? 'active' : ''} onClick={() => setMode('draw')} role="tab">
                  <Feather size={16} />Draw
                </button>
              </div>
              <button className="focus-button" onClick={() => setFocusMode((current) => !current)}>
                {focusMode ? 'Leave focus' : 'Focus mode'}
              </button>
            </div>

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
      </main>
    </div>
  )
}
