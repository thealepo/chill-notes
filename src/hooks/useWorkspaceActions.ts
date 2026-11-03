import { useCallback, useRef, type ChangeEvent } from 'react'
import {
  markdownFilename,
  noteToMarkdown,
  parseImportedNotes,
  serializeNotesExport,
} from '../lib/noteSerialization'
import { downloadFile } from '../lib/platform'
import type { Note } from '../types'
import type { WorkspaceRecovery } from './useWorkspaceStorage'
import type { StoragePersistenceRequest } from '../lib/storageUsage'

interface UseWorkspaceActionsOptions {
  notes: Note[]
  activeNote: Note | undefined
  prependNotes: (notes: Note[]) => void
  recovery: WorkspaceRecovery | null
  replaceUnsafeWorkspace: () => void
  requestPersistence: () => Promise<StoragePersistenceRequest>
  notify: (message: string) => void
}

export function useWorkspaceActions({
  notes,
  activeNote,
  prependNotes,
  recovery,
  replaceUnsafeWorkspace,
  requestPersistence,
  notify,
}: UseWorkspaceActionsOptions) {
  const importInputRef = useRef<HTMLInputElement>(null)

  const exportNotes = useCallback(() => {
    const file = new Blob([serializeNotesExport(notes)], { type: 'application/json' })
    downloadFile(file, `chill-notes-${new Date().toISOString().slice(0, 10)}.json`)
    notify(`Exported ${notes.length} ${notes.length === 1 ? 'note' : 'notes'} as JSON.`)
  }, [notes, notify])

  const downloadWorkspaceRecovery = useCallback(() => {
    if (!recovery) return
    const file = new Blob([recovery.raw], { type: 'application/json;charset=utf-8' })
    downloadFile(file, `chill-notes-indexeddb-recovery-${new Date().toISOString().slice(0, 10)}.json`)
    notify('Downloaded the original IndexedDB data.')
  }, [notify, recovery])

  const replaceRecoveredWorkspace = useCallback(() => {
    if (!recovery) return
    const confirmed = window.confirm(
      'Replace the unreadable saved workspace with the workspace currently open in this tab? '
      + 'Download the original data first if you may need it later.',
    )
    if (!confirmed) return
    replaceUnsafeWorkspace()
    notify('Replacing the saved workspace with the current one.')
  }, [notify, recovery, replaceUnsafeWorkspace])

  const exportActiveNoteAsMarkdown = useCallback(() => {
    if (!activeNote) return false
    const file = new Blob([noteToMarkdown(activeNote)], { type: 'text/markdown;charset=utf-8' })
    downloadFile(file, markdownFilename(activeNote.title))
    notify('Exported this note as Markdown.')
    return true
  }, [activeNote, notify])

  const chooseImportFile = useCallback(() => importInputRef.current?.click(), [])

  const importNotes = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    try {
      const result = parseImportedNotes(await file.text())
      if (result.notes.length === 0) {
        notify(result.skipped > 0
          ? `No valid notes found. Skipped ${result.skipped}.`
          : 'No notes found to import.')
        return
      }

      prependNotes(result.notes)
      const noteLabel = result.notes.length === 1 ? 'note' : 'notes'
      const skipped = result.skipped > 0 ? ` Skipped ${result.skipped}.` : ''
      notify(`Imported ${result.notes.length} ${noteLabel}.${skipped}`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not import that file.')
    } finally {
      input.value = ''
    }
  }, [notify, prependNotes])

  const protectLocalStorage = useCallback(async () => {
    const result = await requestPersistence()
    if (result === 'persistent') {
      notify('Persistent storage enabled. Your local notes are better protected from automatic cleanup.')
      return
    }
    if (result === 'denied') {
      notify('This browser did not grant persistent storage. Keep downloading regular backups.')
      return
    }
    if (result === 'unsupported') {
      notify('Persistent storage is not supported in this browser. Keep downloading regular backups.')
      return
    }
    notify('Could not request persistent storage. Try again from Workspace options.')
  }, [notify, requestPersistence])

  return {
    importInputRef,
    exportNotes,
    downloadWorkspaceRecovery,
    replaceRecoveredWorkspace,
    exportActiveNoteAsMarkdown,
    chooseImportFile,
    importNotes,
    protectLocalStorage,
  }
}
