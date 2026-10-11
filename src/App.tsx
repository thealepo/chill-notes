import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type SetStateAction } from 'react'
import { Menu } from 'lucide-react'
import { AppSidebar, type NoteView, type SortOrder } from './components/AppSidebar'
import { NoteWorkspace } from './components/NoteWorkspace'
import { PwaUpdateNotice } from './components/PwaUpdateNotice'
import { StorageRecoveryNotice } from './components/StorageRecoveryNotice'
import { starterNotes } from './data'
import { useTheme } from './hooks/useTheme'
import { usePwa } from './hooks/usePwa'
import { useWorkspaceStorage } from './hooks/useWorkspaceStorage'
import {
  markdownFilename,
  noteToMarkdown,
  parseImportedNotes,
} from './lib/noteSerialization'
import { downloadFile } from './lib/platform'
import type { EditorMode, Note } from './types'

function autosizeTitle(element: HTMLTextAreaElement | null) {
  if (!element) return
  element.style.height = '0px'
  element.style.height = `${element.scrollHeight}px`
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

const UPDATE_SAVE_TIMEOUT = 10_000

export default function App() {
  const {
    workspace: workspaceState,
    setWorkspace: setWorkspaceState,
    status: storageStatus,
    usage: storageUsage,
    syncedAt,
    flush: flushWorkspace,
  } = useWorkspaceStorage({ notes: starterNotes, tombstones: {} })
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
  const searchInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLTextAreaElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const mobileMenuRef = useRef<HTMLButtonElement>(null)
  const sidebarWasOpenRef = useRef(false)
  const sidebarFocusIntentRef = useRef<'search' | 'title' | null>(null)
  const [query, setQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [updatingPwa, setUpdatingPwa] = useState(false)
  const { preference: themePreference, setPreference: setThemePreference } = useTheme()
  const pwa = usePwa()
  const { dismissOfflineReady, offlineReady, reloadNeeded: pwaReloadNeeded, reloadPage: reloadPwaPage } = pwa
  const previousOnlineRef = useRef(true)
  const pwaReloadRunningRef = useRef(false)

  const setNotes = useCallback((update: SetStateAction<Note[]>) => {
    setWorkspaceState((current) => ({
      ...current,
      notes: typeof update === 'function' ? update(current.notes) : update,
    }))
  }, [setWorkspaceState])

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
    if (syncedAt) setNotice('Synced changes from another tab.')
  }, [syncedAt])

  useEffect(() => {
    if (!offlineReady) return
    setNotice('Chill Notes is ready to use offline.')
    dismissOfflineReady()
  }, [dismissOfflineReady, offlineReady])

  useEffect(() => {
    if (!pwa.registrationFailed) return
    setNotice('Offline setup is unavailable right now. Your notes still save on this device.')
  }, [pwa.registrationFailed])

  useEffect(() => {
    if (previousOnlineRef.current === pwa.online) return
    previousOnlineRef.current = pwa.online
    setNotice(pwa.online ? 'Back online.' : 'You’re offline — your saved notes are still available.')
  }, [pwa.online])

  useEffect(() => {
    if (notes.length > 0 && !notes.some((note) => note.id === activeId)) setActiveId(notes[0].id)
  }, [activeId, notes])

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 700px)').matches
    if (!isMobile) {
      sidebarWasOpenRef.current = sidebarOpen
      sidebarFocusIntentRef.current = null
      return
    }

    let focusFrame: number | undefined
    const focusIntent = sidebarFocusIntentRef.current
    if (sidebarOpen) {
      focusFrame = requestAnimationFrame(() => {
        if (focusIntent === 'search') searchInputRef.current?.focus()
        else document.querySelector<HTMLButtonElement>('.sidebar-close')?.focus()
      })
    } else if (sidebarWasOpenRef.current) {
      focusFrame = requestAnimationFrame(() => {
        if (focusIntent === 'title') titleInputRef.current?.focus()
        else mobileMenuRef.current?.focus()
      })
    }
    sidebarFocusIntentRef.current = null
    sidebarWasOpenRef.current = sidebarOpen
    return () => {
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame)
    }
  }, [sidebarOpen])

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
    const focusThroughSidebar = sidebarOpen && window.matchMedia('(max-width: 700px)').matches
    if (focusThroughSidebar) sidebarFocusIntentRef.current = 'title'
    setNotes((current) => [note, ...current])
    setActiveId(note.id)
    setView('notes')
    setMode('type')
    setSidebarOpen(false)
    setNoteMenuOpen(false)
    if (!focusThroughSidebar) requestAnimationFrame(() => titleInputRef.current?.focus())
  }

  function selectNote(id: string) {
    if (sidebarOpen && window.matchMedia('(max-width: 700px)').matches) {
      sidebarFocusIntentRef.current = 'title'
    }
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

  async function installPwa() {
    setWorkspaceMenuOpen(false)
    try {
      const result = await pwa.promptInstall()
      if (result === 'accepted') setNotice('Chill Notes is being installed.')
      if (result === 'dismissed') setNotice('Installation cancelled. You can try again later.')
      if (result === 'manual') setNotice('In Safari, tap Share, then “Add to Home Screen.”')
      if (result === 'unavailable') setNotice('Install from your browser’s app menu when available.')
    } catch {
      setNotice('Could not open the install prompt. Try your browser’s app menu.')
    }
  }

  const saveBeforePwaReload = useCallback(async () => {
    const savedStatus = await Promise.race([
      flushWorkspace(),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), UPDATE_SAVE_TIMEOUT)),
    ])
    if (!savedStatus) {
      setNotice('Update paused because saving is taking longer than expected. Try again in a moment.')
      return false
    }
    if (savedStatus.phase === 'error') {
      setNotice('Update paused because your latest changes are not saved. Download a backup first.')
      return false
    }
    return true
  }, [flushWorkspace])

  async function updatePwa() {
    setUpdatingPwa(true)
    try {
      if (storageStatus.phase === 'loading' || storageStatus.phase === 'saving') {
        setNotice('Finishing saving before the update…')
      }
      if (!await saveBeforePwaReload()) {
        setUpdatingPwa(false)
        return
      }
      if (pwaReloadNeeded) {
        reloadPwaPage()
        return
      }
      await pwa.updateServiceWorker(true)
    } catch {
      setUpdatingPwa(false)
      setNotice('Could not update right now. Your current version is still available.')
    }
  }

  useEffect(() => {
    if (!pwaReloadNeeded || pwaReloadRunningRef.current) return
    pwaReloadRunningRef.current = true
    setUpdatingPwa(true)
    void saveBeforePwaReload().then((canReload) => {
      if (canReload) {
        reloadPwaPage()
        return
      }
      pwaReloadRunningRef.current = false
      setUpdatingPwa(false)
    })
  }, [pwaReloadNeeded, reloadPwaPage, saveBeforePwaReload])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = target?.matches('input, textarea, [contenteditable="true"]') ?? false
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        // The search field lives in the sidebar, which is hidden in focus mode and on mobile.
        setFocusMode(false)
        if (window.matchMedia('(max-width: 700px)').matches) {
          if (sidebarOpen) searchInputRef.current?.focus()
          else {
            sidebarFocusIntentRef.current = 'search'
            setSidebarOpen(true)
          }
        } else {
          requestAnimationFrame(() => searchInputRef.current?.focus())
        }
        return
      }
      if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && !event.repeat && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        const note = blankNote()
        const focusThroughSidebar = sidebarOpen && window.matchMedia('(max-width: 700px)').matches
        if (focusThroughSidebar) sidebarFocusIntentRef.current = 'title'
        setNotes((current) => [note, ...current])
        setActiveId(note.id)
        setView('notes')
        setMode('type')
        setSidebarOpen(false)
        setNoteMenuOpen(false)
        setWorkspaceMenuOpen(false)
        setSettingsOpen(false)
        if (!focusThroughSidebar) requestAnimationFrame(() => titleInputRef.current?.focus())
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
  }, [setNotes, sidebarOpen])

  if (!activeNote) return null

  return (
    <div className={`app-shell ${focusMode ? 'focus-mode' : ''}`}>
      <button ref={mobileMenuRef} className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open notes">
        <Menu size={20} />
      </button>
      {notice && <div className="toast" role="status">{notice}</div>}
      <StorageRecoveryNotice
        status={storageStatus}
        usage={storageUsage}
        onDownloadBackup={exportNotes}
      />
      {pwa.needRefresh && (
        <PwaUpdateNotice
          updating={updatingPwa}
          onUpdate={updatePwa}
          onDismiss={pwa.dismissUpdate}
        />
      )}

      <AppSidebar
        open={sidebarOpen}
        notes={visibleNotes}
        activeId={activeNote.id}
        view={view}
        query={query}
        favoritesOnly={favoritesOnly}
        sortOrder={sortOrder}
        settingsOpen={settingsOpen}
        workspaceMenuOpen={workspaceMenuOpen}
        storageStatus={storageStatus}
        storageUsage={storageUsage}
        pwaInstallMode={pwa.installMode}
        themePreference={themePreference}
        searchInputRef={searchInputRef}
        importInputRef={importInputRef}
        onClose={() => setSidebarOpen(false)}
        onCreateNote={createNote}
        onQueryChange={setQuery}
        onToggleFavorites={() => setFavoritesOnly((current) => !current)}
        onToggleSort={() => setSortOrder((current) => current === 'updated' ? 'title' : 'updated')}
        onSelectNote={selectNote}
        onShowView={showView}
        onToggleSettings={() => {
          setSettingsOpen((current) => !current)
          setWorkspaceMenuOpen(false)
          setNoteMenuOpen(false)
        }}
        onCloseSettings={() => setSettingsOpen(false)}
        onThemeChange={setThemePreference}
        onToggleWorkspaceMenu={() => {
          setWorkspaceMenuOpen((current) => !current)
          setSettingsOpen(false)
          setNoteMenuOpen(false)
        }}
        onChooseImport={chooseImportFile}
        onExportNotes={exportNotes}
        onInstallApp={installPwa}
        onImportNotes={importNotes}
      />

      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />}

      <NoteWorkspace
        note={activeNote}
        mode={mode}
        saveStatus={storageStatus.phase}
        focusMode={focusMode}
        noteMenuOpen={noteMenuOpen}
        titleInputRef={titleInputRef}
        onModeChange={setMode}
        onToggleFocus={() => setFocusMode((current) => !current)}
        onToggleFavorite={toggleFavorite}
        onToggleNoteMenu={() => {
          setNoteMenuOpen((current) => !current)
          setSettingsOpen(false)
          setWorkspaceMenuOpen(false)
        }}
        onExportMarkdown={exportActiveNoteAsMarkdown}
        onDuplicate={duplicateActiveNote}
        onToggleArchive={toggleArchive}
        onDelete={deleteActiveNote}
        onUpdateNote={updateNote}
      />
    </div>
  )
}
