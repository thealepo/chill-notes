import {
  Archive,
  ArrowDownAZ,
  CalendarClock,
  Download,
  Feather,
  Heart,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Upload,
  X,
} from 'lucide-react'
import type { ChangeEventHandler, RefObject } from 'react'
import type { ThemePreference } from '../hooks/useTheme'
import { modKeyLabel } from '../lib/platform'
import type { Note } from '../types'
import { ThemeSwitcher } from './ThemeSwitcher'

export type NoteView = 'notes' | 'archive'
export type SortOrder = 'updated' | 'title'

interface AppSidebarProps {
  open: boolean
  notes: Note[]
  activeId: string
  view: NoteView
  query: string
  favoritesOnly: boolean
  sortOrder: SortOrder
  settingsOpen: boolean
  workspaceMenuOpen: boolean
  saveFailed: boolean
  themePreference: ThemePreference
  searchInputRef: RefObject<HTMLInputElement>
  importInputRef: RefObject<HTMLInputElement>
  onClose: () => void
  onCreateNote: () => void
  onQueryChange: (query: string) => void
  onToggleFavorites: () => void
  onToggleSort: () => void
  onSelectNote: (id: string) => void
  onShowView: (view: NoteView) => void
  onToggleSettings: () => void
  onCloseSettings: () => void
  onThemeChange: (theme: ThemePreference) => void
  onToggleWorkspaceMenu: () => void
  onChooseImport: () => void
  onExportNotes: () => void
  onImportNotes: ChangeEventHandler<HTMLInputElement>
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

export function AppSidebar({
  open,
  notes,
  activeId,
  view,
  query,
  favoritesOnly,
  sortOrder,
  settingsOpen,
  workspaceMenuOpen,
  saveFailed,
  themePreference,
  searchInputRef,
  importInputRef,
  onClose,
  onCreateNote,
  onQueryChange,
  onToggleFavorites,
  onToggleSort,
  onSelectNote,
  onShowView,
  onToggleSettings,
  onCloseSettings,
  onThemeChange,
  onToggleWorkspaceMenu,
  onChooseImport,
  onExportNotes,
  onImportNotes,
}: AppSidebarProps) {
  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`}>
      <div className="brand-row">
        <div className="brand-mark"><Feather size={18} strokeWidth={1.8} /></div>
        <span className="brand-name">chill notes</span>
        <button className="icon-button sidebar-close" onClick={onClose} aria-label="Close notes">
          <X size={18} />
        </button>
      </div>

      <button className="new-note-button" onClick={onCreateNote}>
        <Plus size={17} />
        New note
        <span className="key-hint">N</span>
      </button>

      <label className="search-field">
        <Search size={16} />
        <input ref={searchInputRef} value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search notes" />
        <span className="key-hint">{modKeyLabel} K</span>
      </label>

      <div className="sidebar-section-label">
        <span>
          {view === 'archive' ? 'Archive' : 'Notes'}
          <span className="note-count">{notes.length}</span>
        </span>
        <div className="sidebar-section-actions">
          <button
            className={`bare-button favorite-filter ${favoritesOnly ? 'active' : ''}`}
            onClick={onToggleFavorites}
            aria-pressed={favoritesOnly}
            aria-label={favoritesOnly ? 'Show all notes' : 'Show favorite notes only'}
            title={favoritesOnly ? 'Showing favorite notes only' : 'Show favorite notes only'}
          >
            <Heart size={14} fill={favoritesOnly ? 'currentColor' : 'none'} />
          </button>
          <button
            className={`bare-button sort-button ${sortOrder === 'title' ? 'alphabetical' : ''}`}
            onClick={onToggleSort}
            aria-pressed={sortOrder === 'title'}
            aria-label={`Sort notes by ${sortOrder === 'updated' ? 'title' : 'last updated'}`}
            title={`Sorted by ${sortOrder === 'updated' ? 'last updated' : 'title'} · click to sort by ${sortOrder === 'updated' ? 'title' : 'last updated'}`}
          >
            {sortOrder === 'title' ? <ArrowDownAZ size={15} /> : <CalendarClock size={15} />}
          </button>
        </div>
      </div>

      <nav className="notes-list" aria-label={favoritesOnly ? 'Favorite notes' : 'Notes'}>
        {notes.map((note) => (
          <button
            key={note.id}
            className={`note-item ${note.id === activeId ? 'active' : ''}`}
            onClick={() => onSelectNote(note.id)}
            aria-current={note.id === activeId ? 'page' : undefined}
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
        {notes.length === 0 && (
          <div className="empty-search">
            {favoritesOnly ? 'No favorite notes found.' : view === 'archive' ? 'Archive is empty.' : 'No notes found.'}
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <button
          className={`sidebar-link ${view === 'archive' ? 'active' : ''}`}
          onClick={() => onShowView(view === 'archive' ? 'notes' : 'archive')}
        >
          {view === 'archive' ? <RotateCcw size={17} /> : <Archive size={17} />}
          {view === 'archive' ? 'Back to notes' : 'Archive'}
        </button>

        <div className="sidebar-control">
          <button
            className={`sidebar-link ${settingsOpen ? 'active' : ''}`}
            onClick={onToggleSettings}
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
                <button className="icon-button" onClick={onCloseSettings} aria-label="Close settings"><X size={15} /></button>
              </div>
              <ThemeSwitcher value={themePreference} onChange={onThemeChange} />
            </div>
          )}
        </div>

        <div className="profile-card">
          <div className="avatar">AS</div>
          <div><strong>Alex's space</strong><span>{saveFailed ? 'Not saved — storage unavailable' : 'Saved locally'}</span></div>
          <button
            className="icon-button profile-menu-button"
            onClick={onToggleWorkspaceMenu}
            aria-label="Workspace options"
            aria-expanded={workspaceMenuOpen}
            data-menu-trigger
          >
            <MoreHorizontal size={17} />
          </button>
          {workspaceMenuOpen && (
            <div className="workspace-menu" role="menu">
              <button onClick={onChooseImport} role="menuitem"><Upload size={15} />Import notes</button>
              <button onClick={onExportNotes} role="menuitem"><Download size={15} />Export all notes</button>
            </div>
          )}
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            onChange={onImportNotes}
            aria-label="Choose a JSON file to import notes"
            hidden
          />
        </div>
      </div>
    </aside>
  )
}
