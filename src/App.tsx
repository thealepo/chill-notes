import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Menu } from 'lucide-react'
import { AppSidebar } from './components/AppSidebar'
import { NoteWorkspace } from './components/NoteWorkspace'
import { PwaUpdateNotice } from './components/PwaUpdateNotice'
import { StorageRecoveryNotice } from './components/StorageRecoveryNotice'
import { starterNotes } from './data'
import { useAppPwa } from './hooks/useAppPwa'
import { useNoteLibrary } from './hooks/useNoteLibrary'
import { useTheme } from './hooks/useTheme'
import { useWorkspaceActions } from './hooks/useWorkspaceActions'
import { useWorkspaceStorage } from './hooks/useWorkspaceStorage'
import type { NoteView } from './lib/noteCollection'
import type { EditorMode } from './types'

function autosizeTitle(element: HTMLTextAreaElement | null) {
  if (!element) return
  element.style.height = '0px'
  element.style.height = `${element.scrollHeight}px`
}

export default function App() {
  const {
    workspace: workspaceState,
    setWorkspace: setWorkspaceState,
    status: storageStatus,
    usage: storageUsage,
    persistence: storagePersistence,
    syncedAt,
    flush: flushWorkspace,
    requestPersistence: requestStoragePersistence,
    recovery: workspaceRecovery,
    replaceUnsafeWorkspace,
  } = useWorkspaceStorage({ notes: starterNotes, tombstones: {} })
  const noteLibrary = useNoteLibrary({ workspace: workspaceState, setWorkspace: setWorkspaceState })
  const {
    notes,
    activeNote,
    visibleNotes,
    view,
    query,
    favoritesOnly,
    sortOrder,
    setQuery,
    selectNote: selectLibraryNote,
    showView: showLibraryView,
    createNote: createLibraryNote,
    prependNotes,
    updateNote,
    toggleActiveFavorite,
    duplicateActiveNote: duplicateLibraryNote,
    toggleActiveArchive,
    deleteActiveNote: deleteLibraryNote,
    toggleFavoritesOnly,
    toggleSortOrder,
  } = noteLibrary
  const [mode, setMode] = useState<EditorMode>(() =>
    new URLSearchParams(window.location.search).get('mode') === 'draw' ? 'draw' : 'type',
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [noteMenuOpen, setNoteMenuOpen] = useState(false)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLTextAreaElement>(null)
  const mobileMenuRef = useRef<HTMLButtonElement>(null)
  const sidebarWasOpenRef = useRef(false)
  const sidebarFocusIntentRef = useRef<'search' | 'title' | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const { preference: themePreference, setPreference: setThemePreference } = useTheme()
  const appPwa = useAppPwa({ storageStatus, flushWorkspace, notify: setNotice })
  const workspaceActions = useWorkspaceActions({
    notes,
    activeNote,
    prependNotes,
    recovery: workspaceRecovery,
    replaceUnsafeWorkspace,
    requestPersistence: requestStoragePersistence,
    notify: setNotice,
  })

  useEffect(() => {
    if (syncedAt) setNotice('Synced changes from another tab.')
  }, [syncedAt])

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

  const createNote = useCallback(() => {
    const focusThroughSidebar = sidebarOpen && window.matchMedia('(max-width: 700px)').matches
    if (focusThroughSidebar) sidebarFocusIntentRef.current = 'title'
    createLibraryNote()
    setMode('type')
    setSidebarOpen(false)
    setNoteMenuOpen(false)
    if (!focusThroughSidebar) requestAnimationFrame(() => titleInputRef.current?.focus())
  }, [createLibraryNote, sidebarOpen])

  function selectNote(id: string) {
    if (sidebarOpen && window.matchMedia('(max-width: 700px)').matches) {
      sidebarFocusIntentRef.current = 'title'
    }
    selectLibraryNote(id)
    setSidebarOpen(false)
    setNoteMenuOpen(false)
  }

  function showView(nextView: NoteView) {
    if (!showLibraryView(nextView)) {
      setNotice('Archive is empty.')
      setSidebarOpen(false)
      return
    }
    setSettingsOpen(false)
    setWorkspaceMenuOpen(false)
    setSidebarOpen(false)
    setNotice('')
  }

  function duplicateActiveNote() {
    if (!duplicateLibraryNote()) return
    setNoteMenuOpen(false)
  }

  function toggleArchive() {
    const result = toggleActiveArchive()
    if (!result) return
    setNoteMenuOpen(false)
    if (result === 'restored') {
      setNotice('Note restored.')
      return
    }
    setNotice('Note archived.')
  }

  function deleteActiveNote() {
    if (!activeNote || !window.confirm('Delete this note? This cannot be undone.')) return
    deleteLibraryNote()
    setNoteMenuOpen(false)
  }

  function exportNotes() {
    setWorkspaceMenuOpen(false)
    workspaceActions.exportNotes()
  }

  function exportActiveNoteAsMarkdown() {
    if (!workspaceActions.exportActiveNoteAsMarkdown()) return
    setNoteMenuOpen(false)
  }

  function chooseImportFile() {
    setWorkspaceMenuOpen(false)
    workspaceActions.chooseImportFile()
  }

  async function installPwa() {
    setWorkspaceMenuOpen(false)
    await appPwa.install()
  }

  async function protectLocalStorage() {
    await workspaceActions.protectLocalStorage()
    setWorkspaceMenuOpen(false)
  }

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
        createNote()
        setWorkspaceMenuOpen(false)
        setSettingsOpen(false)
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
  }, [createNote, sidebarOpen])

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
        recovery={workspaceRecovery}
        onDownloadBackup={exportNotes}
        onDownloadRecovery={workspaceActions.downloadWorkspaceRecovery}
        onReplaceWorkspace={workspaceActions.replaceRecoveredWorkspace}
      />
      {appPwa.needRefresh && (
        <PwaUpdateNotice
          updating={appPwa.updating}
          onUpdate={appPwa.update}
          onDismiss={appPwa.dismissUpdate}
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
        storagePersistence={storagePersistence}
        pwaInstallMode={appPwa.installMode}
        themePreference={themePreference}
        searchInputRef={searchInputRef}
        importInputRef={workspaceActions.importInputRef}
        onClose={() => setSidebarOpen(false)}
        onCreateNote={createNote}
        onQueryChange={setQuery}
        onToggleFavorites={toggleFavoritesOnly}
        onToggleSort={toggleSortOrder}
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
        onRequestStoragePersistence={protectLocalStorage}
        onInstallApp={installPwa}
        onImportNotes={workspaceActions.importNotes}
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
        onToggleFavorite={toggleActiveFavorite}
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
