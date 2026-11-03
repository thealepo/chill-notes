import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import { Menu } from 'lucide-react'
import { AppSidebar } from './components/AppSidebar'
import { NoteWorkspace } from './components/NoteWorkspace'
import { PwaUpdateNotice } from './components/PwaUpdateNotice'
import { StorageRecoveryNotice } from './components/StorageRecoveryNotice'
import { starterNotes } from './data'
import { useNoteLibrary } from './hooks/useNoteLibrary'
import { useTheme } from './hooks/useTheme'
import { usePwa } from './hooks/usePwa'
import { useWorkspaceStorage } from './hooks/useWorkspaceStorage'
import {
  markdownFilename,
  noteToMarkdown,
  parseImportedNotes,
  serializeNotesExport,
} from './lib/noteSerialization'
import type { NoteView } from './lib/noteCollection'
import { downloadFile } from './lib/platform'
import type { EditorMode } from './types'

function autosizeTitle(element: HTMLTextAreaElement | null) {
  if (!element) return
  element.style.height = '0px'
  element.style.height = `${element.scrollHeight}px`
}

const UPDATE_SAVE_TIMEOUT = 10_000

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
  const importInputRef = useRef<HTMLInputElement>(null)
  const mobileMenuRef = useRef<HTMLButtonElement>(null)
  const sidebarWasOpenRef = useRef(false)
  const sidebarFocusIntentRef = useRef<'search' | 'title' | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [updatingPwa, setUpdatingPwa] = useState(false)
  const { preference: themePreference, setPreference: setThemePreference } = useTheme()
  const pwa = usePwa()
  const { dismissOfflineReady, offlineReady, reloadNeeded: pwaReloadNeeded, reloadPage: reloadPwaPage } = pwa
  const previousOnlineRef = useRef(true)
  const pwaReloadRunningRef = useRef(false)

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
    const file = new Blob([serializeNotesExport(notes)], { type: 'application/json' })
    downloadFile(file, `chill-notes-${new Date().toISOString().slice(0, 10)}.json`)
    setWorkspaceMenuOpen(false)
    setNotice(`Exported ${notes.length} ${notes.length === 1 ? 'note' : 'notes'} as JSON.`)
  }

  function downloadWorkspaceRecovery() {
    if (!workspaceRecovery) return
    const file = new Blob([workspaceRecovery.raw], { type: 'application/json;charset=utf-8' })
    downloadFile(file, `chill-notes-indexeddb-recovery-${new Date().toISOString().slice(0, 10)}.json`)
    setNotice('Downloaded the original IndexedDB data.')
  }

  function replaceRecoveredWorkspace() {
    if (!workspaceRecovery) return
    const confirmed = window.confirm(
      'Replace the unreadable saved workspace with the workspace currently open in this tab? '
      + 'Download the original data first if you may need it later.',
    )
    if (!confirmed) return
    replaceUnsafeWorkspace()
    setNotice('Replacing the saved workspace with the current one.')
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

      prependNotes(result.notes)
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

  async function protectLocalStorage() {
    const result = await requestStoragePersistence()
    setWorkspaceMenuOpen(false)
    if (result === 'persistent') {
      setNotice('Persistent storage enabled. Your local notes are better protected from automatic cleanup.')
      return
    }
    if (result === 'denied') {
      setNotice('This browser did not grant persistent storage. Keep downloading regular backups.')
      return
    }
    if (result === 'unsupported') {
      setNotice('Persistent storage is not supported in this browser. Keep downloading regular backups.')
      return
    }
    setNotice('Could not request persistent storage. Try again from Workspace options.')
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
    if (savedStatus.phase === 'error' || savedStatus.phase === 'recovery') {
      setNotice(savedStatus.phase === 'recovery'
        ? 'Update paused while saved data needs recovery. Download or replace it first.'
        : 'Update paused because your latest changes are not saved. Download a backup first.')
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
        onDownloadRecovery={downloadWorkspaceRecovery}
        onReplaceWorkspace={replaceRecoveredWorkspace}
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
        storagePersistence={storagePersistence}
        pwaInstallMode={pwa.installMode}
        themePreference={themePreference}
        searchInputRef={searchInputRef}
        importInputRef={importInputRef}
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
