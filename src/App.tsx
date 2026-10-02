import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type SetStateAction } from 'react'
import {
  AlertCircle,
  Archive,
  ArrowDownAZ,
  CalendarClock,
  Command,
  Copy,
  Download,
  Feather,
  FileText,
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
  Upload,
  X,
} from 'lucide-react'
import { DrawingCanvas } from './components/DrawingCanvas'
import { NoteEditor } from './components/NoteEditor'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { starterNotes } from './data'
import { useTheme } from './hooks/useTheme'
import {
  markdownFilename,
  mergeStoredWorkspaces,
  normalizeStoredWorkspace,
  noteToMarkdown,
  parseImportedNotes,
  serializeStoredWorkspace,
  type StoredWorkspace,
} from './lib/noteSerialization'
import { downloadFile, modKeyLabel } from './lib/platform'
import type { EditorMode, Note } from './types'

const STORAGE_KEY = 'chill-notes-v1'
const CORRUPT_BACKUP_KEY = 'chill-notes-v1-unreadable-backup'

type NoteView = 'notes' | 'archive'
type SortOrder = 'updated' | 'title'

function readWorkspace(): StoredWorkspace {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { notes: starterNotes, tombstones: {} }
    const workspace = normalizeStoredWorkspace(JSON.parse(saved))
    if (workspace.notes.length > 0) return workspace
  } catch {
    // Fall through to the starter note below.
  }
  // Keep a copy of unreadable data so the next save does not silently destroy it.
  try {
    if (saved) localStorage.setItem(CORRUPT_BACKUP_KEY, saved)
  } catch {
    // Storage may be unavailable or full; nothing else we can do here.
  }
  return { notes: starterNotes, tombstones: {} }
}

function relativeTime(timestamp: number) {
  const diff = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  })
}

function autosizeTitle(element: HTMLTextAreaElement | null) {
  if (!element) return
  element.style.height = '0px'
  element.style.height = `${element.scrollHeight}px`
}

function focusFirstBlock() {
  document.querySelector<HTMLTextAreaElement>('.notion-editor .block-content textarea')?.focus()
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
  const [workspaceState, setWorkspaceState] = useState<StoredWorkspace>(readWorkspace)
  const notes = workspaceState.notes
  const [activeId, setActiveId] = useState(() => notes[0]?.id ?? '')
  const [mode, setMode] = useState<EditorMode>(() =>
    new URLSearchParams(window.location.search).get('mode') === 'draw' ? 'draw' : 'type',
  )
  const [view, setView] = useState<NoteView>('notes')
  const [sortOrder, setSortOrder] = useState<SortOrder>('updated')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [noteMenuOpen, setNoteMenuOpen] = useState(false)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  const saveFailedRef = useRef(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLTextAreaElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const { preference: themePreference, setPreference: setThemePreference } = useTheme()

  function setNotes(update: SetStateAction<Note[]>) {
    setWorkspaceState((current) => ({
      ...current,
      notes: typeof update === 'function' ? update(current.notes) : update,
    }))
  }

  const activeNote = notes.find((note) => note.id === activeId) ?? notes[0]
  const visibleNotes = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return notes
      .filter((note) => {
        if (Boolean(note.archived) !== (view === 'archive')) return false
        if (favoritesOnly && !note.favorite) return false
        if (!normalized) return true
        const body = note.blocks.map((block) => block.content).join(' ')
        return `${note.title} ${body}`.toLowerCase().includes(normalized)
      })
      .sort((a, b) => sortOrder === 'title'
        ? (a.title || 'Untitled note').localeCompare(b.title || 'Untitled note')
        : b.updatedAt - a.updatedAt)
  }, [favoritesOnly, notes, query, sortOrder, view])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeStoredWorkspace(workspaceState))
      if (saveFailedRef.current) {
        saveFailedRef.current = false
        setSaveFailed(false)
      }
    } catch {
      // Quota exceeded (often from large drawings) or storage unavailable. Keep the
      // in-memory notes and tell the user instead of crashing the app.
      if (!saveFailedRef.current) {
        saveFailedRef.current = true
        setSaveFailed(true)
        setNotice('Could not save to this browser. Export a backup to keep your changes.')
      }
    }
  }, [workspaceState])

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      try {
        const incoming = normalizeStoredWorkspace(JSON.parse(event.newValue))
        if (incoming.notes.length === 0) return
        setWorkspaceState((current) => {
          const merged = mergeStoredWorkspaces(current, incoming)
          return serializeStoredWorkspace(merged) === serializeStoredWorkspace(current) ? current : merged
        })
        setNotice('Synced changes from another tab.')
      } catch {
        setNotice('Ignored unreadable changes from another tab.')
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    if (notes.length > 0 && !notes.some((note) => note.id === activeId)) setActiveId(notes[0].id)
  }, [activeId, notes])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [notice])

  // Close popover menus when interacting anywhere outside them.
  useEffect(() => {
    if (!settingsOpen && !noteMenuOpen && !workspaceMenuOpen) return
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Element | null
      if (target?.closest('.settings-panel, .workspace-menu, .note-menu, [data-menu-trigger]')) return
      setSettingsOpen(false)
      setNoteMenuOpen(false)
      setWorkspaceMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [settingsOpen, noteMenuOpen, workspaceMenuOpen])

  // The title is a wrapping textarea; keep its height in sync with content and width.
  useLayoutEffect(() => {
    const title = titleInputRef.current
    autosizeTitle(title)
    if (!title) return
    const observer = new ResizeObserver(() => autosizeTitle(title))
    observer.observe(title)
    return () => observer.disconnect()
  }, [activeNote?.id, activeNote?.title, mode])

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
    // Prefer the next note the user can actually see in the sidebar.
    const nextInView = visibleNotes.find((note) => note.id !== activeNote.id)
      ?? notes.find((note) => note.id !== activeNote.id && Boolean(note.archived) === (view === 'archive'))
    updateNote(updated)
    setNoteMenuOpen(false)

    if (!archived) {
      setView('notes')
      setNotice('Note restored.')
      return
    }
    setNotice('Note archived.')
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
    let nextNote = visibleNotes.find((note) => note.id !== activeNote.id)
      ?? remaining.find((note) => Boolean(note.archived) === (view === 'archive'))

    if (!nextNote && view === 'archive') {
      setView('notes')
      nextNote = remaining.find((note) => !note.archived)
    }
    if (!nextNote) {
      nextNote = blankNote()
      remaining.unshift(nextNote)
      setView('notes')
    }

    const deletedAt = Date.now()
    setWorkspaceState((current) => ({
      notes: remaining,
      tombstones: {
        ...current.tombstones,
        [activeNote.id]: Math.max(current.tombstones[activeNote.id] ?? -1, deletedAt),
      },
    }))
    setActiveId(nextNote.id)
    setNoteMenuOpen(false)
  }

  function exportNotes() {
    const file = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' })
    downloadFile(file, `chill-notes-${new Date().toISOString().slice(0, 10)}.json`)
    setWorkspaceMenuOpen(false)
    setNotice(`Exported ${notes.length} ${notes.length === 1 ? 'note' : 'notes'} as JSON.`)
  }

  function exportActiveNoteAsMarkdown() {
    if (!activeNote) return
    const file = new Blob([noteToMarkdown(activeNote)], { type: 'text/markdown;charset=utf-8' })
    downloadFile(file, markdownFilename(activeNote.title))
    setNoteMenuOpen(false)
    setNotice('Exported this note as Markdown.')
  }

  function chooseImportFile() {
    setWorkspaceMenuOpen(false)
    importInputRef.current?.click()
  }

  async function importNotes(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    try {
      const result = parseImportedNotes(await file.text())
      if (result.notes.length === 0) {
        setNotice(result.skipped > 0 ? `No valid notes found. Skipped ${result.skipped}.` : 'No notes found to import.')
        return
      }

      setNotes((current) => [...result.notes, ...current])
      const noteLabel = result.notes.length === 1 ? 'note' : 'notes'
      const skipped = result.skipped > 0 ? ` Skipped ${result.skipped}.` : ''
      setNotice(`Imported ${result.notes.length} ${noteLabel}.${skipped}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not import that file.')
    } finally {
      input.value = ''
    }
  }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = target?.matches('input, textarea, [contenteditable="true"]') ?? false
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        // The search field lives in the sidebar, which is hidden in focus mode and on mobile.
        setFocusMode(false)
        if (window.matchMedia('(max-width: 700px)').matches) setSidebarOpen(true)
        requestAnimationFrame(() => searchInputRef.current?.focus())
        return
      }
      if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && !event.repeat && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        const note = blankNote()
        setNotes((current) => [note, ...current])
        setActiveId(note.id)
        setView('notes')
        setMode('type')
        setSidebarOpen(false)
        setNoteMenuOpen(false)
        setWorkspaceMenuOpen(false)
        setSettingsOpen(false)
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
          <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes" />
          <span className="key-hint">{modKeyLabel} K</span>
        </label>

        <div className="sidebar-section-label">
          <span>
            {view === 'archive' ? 'Archive' : 'Notes'}
            <span className="note-count">{visibleNotes.length}</span>
          </span>
          <div className="sidebar-section-actions">
            <button
              className={`bare-button favorite-filter ${favoritesOnly ? 'active' : ''}`}
              onClick={() => setFavoritesOnly((current) => !current)}
              aria-pressed={favoritesOnly}
              aria-label={favoritesOnly ? 'Show all notes' : 'Show favorite notes only'}
              title={favoritesOnly ? 'Showing favorite notes only' : 'Show favorite notes only'}
            >
              <Heart size={14} fill={favoritesOnly ? 'currentColor' : 'none'} />
            </button>
            <button
              className={`bare-button sort-button ${sortOrder === 'title' ? 'alphabetical' : ''}`}
              onClick={() => setSortOrder((current) => current === 'updated' ? 'title' : 'updated')}
              aria-pressed={sortOrder === 'title'}
              aria-label={`Sort notes by ${sortOrder === 'updated' ? 'title' : 'last updated'}`}
              title={`Sorted by ${sortOrder === 'updated' ? 'last updated' : 'title'} · click to sort by ${sortOrder === 'updated' ? 'title' : 'last updated'}`}
            >
              {sortOrder === 'title' ? <ArrowDownAZ size={15} /> : <CalendarClock size={15} />}
            </button>
          </div>
        </div>

        <nav className="notes-list" aria-label={favoritesOnly ? 'Favorite notes' : 'Notes'}>
          {visibleNotes.map((note) => (
            <button
              key={note.id}
              className={`note-item ${note.id === activeNote.id ? 'active' : ''}`}
              onClick={() => selectNote(note.id)}
              aria-current={note.id === activeNote.id ? 'page' : undefined}
            >
              <span className={`note-icon ${note.pageIcon ? 'has-emoji' : ''}`} aria-hidden="true">{note.pageIcon || (note.favorite ? '✦' : '◌')}</span>
              <span className="note-details">
                <span className="note-title">{note.title || 'Untitled note'}</span>
                <span className="note-meta">
                  {note.favorite && <Heart size={10} fill="currentColor" aria-label="Favorite" />}
                  {relativeTime(note.updatedAt)}
                </span>
              </span>
            </button>
          ))}
          {visibleNotes.length === 0 && (
            <div className="empty-search">
              {favoritesOnly ? 'No favorite notes found.' : view === 'archive' ? 'Archive is empty.' : 'No notes found.'}
            </div>
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
              onClick={() => { setSettingsOpen((current) => !current); setWorkspaceMenuOpen(false); setNoteMenuOpen(false) }}
              aria-expanded={settingsOpen}
              aria-controls="sidebar-settings"
              data-menu-trigger
            >
              <Settings size={17} />Settings
            </button>
            {settingsOpen && (
              <div id="sidebar-settings" className="settings-panel" role="region" aria-labelledby="sidebar-settings-title">
                <div className="panel-heading">
                  <strong id="sidebar-settings-title">Settings</strong>
                  <button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={15} /></button>
                </div>
                <ThemeSwitcher value={themePreference} onChange={setThemePreference} />
              </div>
            )}
          </div>

          <div className="profile-card">
            <div className="avatar">AS</div>
            <div><strong>Alex's space</strong><span>{saveFailed ? 'Not saved — storage unavailable' : 'Saved locally'}</span></div>
            <button
              className="icon-button profile-menu-button"
              onClick={() => { setWorkspaceMenuOpen((current) => !current); setSettingsOpen(false); setNoteMenuOpen(false) }}
              aria-label="Workspace options"
              aria-expanded={workspaceMenuOpen}
              data-menu-trigger
            >
              <MoreHorizontal size={17} />
            </button>
            {workspaceMenuOpen && (
              <div className="workspace-menu" role="menu">
                <button onClick={chooseImportFile} role="menuitem"><Upload size={15} />Import notes</button>
                <button onClick={exportNotes} role="menuitem"><Download size={15} />Export all notes</button>
              </div>
            )}
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              onChange={importNotes}
              aria-label="Choose a JSON file to import notes"
              hidden
            />
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
            <span className={`save-state ${saveFailed ? 'is-error' : ''}`} role="status">
              {saveFailed ? <AlertCircle size={13} /> : <span className="save-dot" />}
              {saveFailed ? 'Not saved' : 'Saved'}
            </span>
            <button className="focus-button topbar-focus" onClick={() => setFocusMode((current) => !current)} aria-pressed={focusMode}>
              {focusMode ? 'Leave focus' : 'Focus'}
            </button>
            <button className={`icon-button ${activeNote.favorite ? 'favorite' : ''}`} onClick={toggleFavorite} aria-label={activeNote.favorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={activeNote.favorite}>
              <Heart size={18} fill={activeNote.favorite ? 'currentColor' : 'none'} />
            </button>
            <button
              className={`icon-button ${noteMenuOpen ? 'is-open' : ''}`}
              onClick={() => { setNoteMenuOpen((current) => !current); setSettingsOpen(false); setWorkspaceMenuOpen(false) }}
              aria-label="Note options"
              aria-expanded={noteMenuOpen}
              data-menu-trigger
            >
              <MoreHorizontal size={20} />
            </button>
            {noteMenuOpen && (
              <div className="note-menu" role="menu">
                <button onClick={exportActiveNoteAsMarkdown} role="menuitem"><FileText size={15} />Export as Markdown</button>
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

              <textarea
                ref={titleInputRef}
                className="title-input"
                rows={1}
                value={activeNote.title}
                onChange={(event) => updateNote({ ...activeNote, title: event.target.value.replace(/\r?\n/g, ' '), updatedAt: Date.now() })}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                  event.preventDefault()
                  if (mode === 'type') focusFirstBlock()
                }}
                aria-label="Note title"
                placeholder="Untitled"
              />

              {mode === 'type' ? (
                <NoteEditor key={activeNote.id} note={activeNote} onChange={updateNote} />
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
