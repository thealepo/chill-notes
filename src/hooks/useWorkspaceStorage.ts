import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  mergeStoredWorkspaces,
  normalizeStoredWorkspace,
  serializeStoredWorkspace,
  type StoredWorkspace,
} from '../lib/noteSerialization'
import type { StorageUsage } from '../lib/storageUsage'
import {
  announceWorkspaceChange,
  estimateStorageUsage,
  LEGACY_WORKSPACE_KEY,
  readIndexedWorkspace,
  readLegacyWorkspace,
  removeLegacyWorkspace,
  WORKSPACE_CHANNEL_NAME,
  WORKSPACE_SYNC_KEY,
  writeIndexedWorkspace,
  writeLegacyWorkspace,
} from '../lib/workspaceStorage'

export type WorkspaceSavePhase = 'loading' | 'saving' | 'saved' | 'warning' | 'error'
export type WorkspaceStorageBackend = 'indexeddb' | 'localstorage'

export interface WorkspaceStorageStatus {
  phase: WorkspaceSavePhase
  backend: WorkspaceStorageBackend | null
  detail?: string
}

interface UseWorkspaceStorageResult {
  workspace: StoredWorkspace
  setWorkspace: Dispatch<SetStateAction<StoredWorkspace>>
  status: WorkspaceStorageStatus
  usage: StorageUsage | null
  syncedAt: number | null
}

const IDB_FALLBACK_DETAIL = 'Using limited browser storage. Download a backup before adding large drawings.'
const SAVE_FAILED_DETAIL = 'Changes are only in this tab. Download a recovery backup before closing it.'

function sameWorkspace(first: StoredWorkspace, second: StoredWorkspace): boolean {
  return serializeStoredWorkspace(first) === serializeStoredWorkspace(second)
}

export function useWorkspaceStorage(fallbackWorkspace: StoredWorkspace): UseWorkspaceStorageResult {
  const legacyReadRef = useRef<ReturnType<typeof readLegacyWorkspace> | null>(null)
  if (legacyReadRef.current === null) legacyReadRef.current = readLegacyWorkspace()

  const [workspace, setWorkspaceState] = useState<StoredWorkspace>(() => (
    legacyReadRef.current?.workspace ?? fallbackWorkspace
  ))
  const [status, setStatus] = useState<WorkspaceStorageStatus>({ phase: 'loading', backend: null })
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const [syncedAt, setSyncedAt] = useState<number | null>(null)
  const hydratedRef = useRef(false)
  const touchedBeforeHydrationRef = useRef(false)
  const workspaceRef = useRef(workspace)
  const revisionRef = useRef(0)
  const saveQueueRef = useRef(Promise.resolve())
  const channelRef = useRef<BroadcastChannel | null>(null)
  const mountedRef = useRef(true)
  workspaceRef.current = workspace

  const setWorkspace: Dispatch<SetStateAction<StoredWorkspace>> = useCallback((update) => {
    if (!hydratedRef.current) touchedBeforeHydrationRef.current = true
    setWorkspaceState(update)
  }, [])

  const refreshUsage = useCallback(async () => {
    const nextUsage = await estimateStorageUsage()
    if (mountedRef.current) setUsage(nextUsage)
  }, [])

  const persist = useCallback((snapshot: StoredWorkspace) => {
    const revision = ++revisionRef.current
    setStatus((current) => ({ ...current, phase: 'saving' }))

    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await writeIndexedWorkspace(snapshot)
          removeLegacyWorkspace()
          announceWorkspaceChange()
          channelRef.current?.postMessage({ type: 'workspace-changed' })
          if (mountedRef.current && revision === revisionRef.current) {
            setStatus({ phase: 'saved', backend: 'indexeddb' })
            await refreshUsage()
          }
          return
        } catch {
          // Private browsing modes and restrictive browser settings can disable
          // IndexedDB. Retain the previous localStorage path as a fallback.
        }

        try {
          writeLegacyWorkspace(snapshot)
          if (mountedRef.current && revision === revisionRef.current) {
            setStatus({ phase: 'warning', backend: 'localstorage', detail: IDB_FALLBACK_DETAIL })
            await refreshUsage()
          }
        } catch {
          if (mountedRef.current && revision === revisionRef.current) {
            setStatus({ phase: 'error', backend: null, detail: SAVE_FAILED_DETAIL })
            await refreshUsage()
          }
        }
      })
  }, [refreshUsage])

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false
    const legacyRead = legacyReadRef.current

    void (async () => {
      let indexedWorkspace: StoredWorkspace | null = null
      try {
        indexedWorkspace = await readIndexedWorkspace()
      } catch {
        // The first save below will attempt localStorage if IndexedDB stays unavailable.
      }

      if (cancelled || !mountedRef.current) return
      const currentWorkspace = workspaceRef.current
      const shouldMergeCurrent = Boolean(legacyRead?.workspace) || touchedBeforeHydrationRef.current
      const hydratedWorkspace = indexedWorkspace
        ? shouldMergeCurrent
          ? mergeStoredWorkspaces(indexedWorkspace, currentWorkspace)
          : indexedWorkspace
        : currentWorkspace

      if (!sameWorkspace(currentWorkspace, hydratedWorkspace)) {
        workspaceRef.current = hydratedWorkspace
        setWorkspaceState(hydratedWorkspace)
      }
      hydratedRef.current = true
      persist(hydratedWorkspace)
    })()

    return () => {
      cancelled = true
      mountedRef.current = false
    }
  }, [persist])

  useEffect(() => {
    if (!hydratedRef.current) return
    persist(workspace)
  }, [persist, workspace])

  useEffect(() => {
    async function mergeLatestIndexedWorkspace() {
      try {
        const incoming = await readIndexedWorkspace()
        if (!incoming || !mountedRef.current) return
        setWorkspaceState((current) => {
          const merged = mergeStoredWorkspaces(current, incoming)
          if (sameWorkspace(current, merged)) return current
          workspaceRef.current = merged
          return merged
        })
        setSyncedAt(Date.now())
      } catch {
        // Another tab may be using the localStorage fallback instead.
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === WORKSPACE_SYNC_KEY) {
        void mergeLatestIndexedWorkspace()
        return
      }
      if (event.key !== LEGACY_WORKSPACE_KEY || !event.newValue) return
      try {
        const incoming = normalizeStoredWorkspace(JSON.parse(event.newValue))
        if (incoming.notes.length === 0) return
        setWorkspaceState((current) => {
          const merged = mergeStoredWorkspaces(current, incoming)
          if (sameWorkspace(current, merged)) return current
          workspaceRef.current = merged
          return merged
        })
        setSyncedAt(Date.now())
      } catch {
        // Ignore unreadable writes from an older or unrelated tab.
      }
    }

    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel(WORKSPACE_CHANNEL_NAME)
      channel.onmessage = () => void mergeLatestIndexedWorkspace()
      channelRef.current = channel
    } catch {
      // The lightweight localStorage signal remains available as a fallback.
    }

    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
      channel?.close()
      if (channelRef.current === channel) channelRef.current = null
    }
  }, [])

  return { workspace, setWorkspace, status, usage, syncedAt }
}
