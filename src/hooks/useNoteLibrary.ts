import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  createBlankNote,
  duplicateNote,
  getVisibleNotes,
  type NoteView,
  type SortOrder,
} from '../lib/noteCollection'
import type { StoredWorkspace } from '../lib/noteSerialization'
import type { Note } from '../types'

interface UseNoteLibraryOptions {
  workspace: StoredWorkspace
  setWorkspace: Dispatch<SetStateAction<StoredWorkspace>>
}

export function useNoteLibrary({ workspace, setWorkspace }: UseNoteLibraryOptions) {
  const notes = workspace.notes
  const [activeId, setActiveId] = useState(() => notes[0]?.id ?? '')
  const [view, setView] = useState<NoteView>('notes')
  const [sortOrder, setSortOrder] = useState<SortOrder>('updated')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [query, setQuery] = useState('')

  const setNotes = useCallback((update: SetStateAction<Note[]>) => {
    setWorkspace((current) => ({
      ...current,
      notes: typeof update === 'function' ? update(current.notes) : update,
    }))
  }, [setWorkspace])

  const activeNote = notes.find((note) => note.id === activeId) ?? notes[0]
  const visibleNotes = useMemo(() => getVisibleNotes(notes, {
    view,
    query,
    favoritesOnly,
    sortOrder,
  }), [favoritesOnly, notes, query, sortOrder, view])

  useEffect(() => {
    if (notes.length > 0 && !notes.some((note) => note.id === activeId)) {
      setActiveId(notes[0].id)
    }
  }, [activeId, notes])

  const updateNote = useCallback((updated: Note) => {
    setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)))
  }, [setNotes])

  const createNote = useCallback(() => {
    const note = createBlankNote()
    setNotes((current) => [note, ...current])
    setActiveId(note.id)
    setView('notes')
    return note
  }, [setNotes])

  const prependNotes = useCallback((importedNotes: Note[]) => {
    setNotes((current) => [...importedNotes, ...current])
  }, [setNotes])

  const showView = useCallback((nextView: NoteView) => {
    const nextNote = notes.find((note) => Boolean(note.archived) === (nextView === 'archive'))
    if (!nextNote && nextView === 'archive') return false
    setView(nextView)
    setQuery('')
    if (nextNote) setActiveId(nextNote.id)
    return true
  }, [notes])

  const toggleActiveFavorite = useCallback(() => {
    if (!activeNote) return
    updateNote({ ...activeNote, favorite: !activeNote.favorite, updatedAt: Date.now() })
  }, [activeNote, updateNote])

  const duplicateActiveNote = useCallback(() => {
    if (!activeNote) return null
    const duplicate = duplicateNote(activeNote)
    setNotes((current) => [duplicate, ...current])
    setActiveId(duplicate.id)
    return duplicate
  }, [activeNote, setNotes])

  const toggleActiveArchive = useCallback(() => {
    if (!activeNote) return null
    const archived = !activeNote.archived
    const updated = { ...activeNote, archived, updatedAt: Date.now() }
    const nextInView = visibleNotes.find((note) => note.id !== activeNote.id)
      ?? notes.find((note) => note.id !== activeNote.id && Boolean(note.archived) === (view === 'archive'))
    updateNote(updated)

    if (!archived) {
      setView('notes')
      return 'restored' as const
    }
    if (nextInView) {
      setActiveId(nextInView.id)
      return 'archived' as const
    }
    const note = createBlankNote()
    setNotes((current) => [note, ...current])
    setActiveId(note.id)
    setView('notes')
    return 'archived' as const
  }, [activeNote, notes, setNotes, updateNote, view, visibleNotes])

  const deleteActiveNote = useCallback(() => {
    if (!activeNote) return false
    const remaining = notes.filter((note) => note.id !== activeNote.id)
    let nextNote = visibleNotes.find((note) => note.id !== activeNote.id)
      ?? remaining.find((note) => Boolean(note.archived) === (view === 'archive'))

    if (!nextNote && view === 'archive') {
      setView('notes')
      nextNote = remaining.find((note) => !note.archived)
    }
    if (!nextNote) {
      nextNote = createBlankNote()
      remaining.unshift(nextNote)
      setView('notes')
    }

    const deletedAt = Date.now()
    setWorkspace((current) => ({
      notes: remaining,
      tombstones: {
        ...current.tombstones,
        [activeNote.id]: Math.max(current.tombstones[activeNote.id] ?? -1, deletedAt),
      },
    }))
    setActiveId(nextNote.id)
    return true
  }, [activeNote, notes, setWorkspace, view, visibleNotes])

  const selectNote = useCallback((id: string) => setActiveId(id), [])
  const toggleFavoritesOnly = useCallback(() => setFavoritesOnly((current) => !current), [])
  const toggleSortOrder = useCallback(() => {
    setSortOrder((current) => current === 'updated' ? 'title' : 'updated')
  }, [])

  return {
    notes,
    activeNote,
    visibleNotes,
    activeId,
    view,
    query,
    favoritesOnly,
    sortOrder,
    setQuery,
    selectNote,
    showView,
    createNote,
    prependNotes,
    updateNote,
    toggleActiveFavorite,
    duplicateActiveNote,
    toggleActiveArchive,
    deleteActiveNote,
    toggleFavoritesOnly,
    toggleSortOrder,
  }
}
