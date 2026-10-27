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
  type IndexedWorkspaceRead,
} from '../lib/workspaceStorage'

export type WorkspaceSavePhase = 'loading' | 'saving' | 'saved' | 'warning' | 'error' | 'recovery'
export type WorkspaceStorageBackend = 'indexeddb' | 'localstorage'

export interface WorkspaceStorageStatus {
  phase: WorkspaceSavePhase
  backend: WorkspaceStorageBackend | null
  detail?: string
}

export interface WorkspaceRecovery {
  kind: 'corrupt' | 'unsupported-version'
  raw: string
  preserved: boolean
  version?: number | string | null
}

interface UseWorkspaceStorageResult {
  workspace: StoredWorkspace
  setWorkspace: Dispatch<SetStateAction<StoredWorkspace>>
  status: WorkspaceStorageStatus
  usage: StorageUsage | null
  syncedAt: number | null
  flush: () => Promise<WorkspaceStorageStatus>
  recovery: WorkspaceRecovery | null
  replaceUnsafeWorkspace: () => void
}

interface PendingWorkspaceSave {
  snapshot: StoredWorkspace
  revision: number
}

const IDB_FALLBACK_DETAIL = 'Using limited browser storage. Download a backup before adding large drawings.'
const SAVE_FAILED_DETAIL = 'Changes are only in this tab. Download a recovery backup before closing it.'
const CORRUPT_WORKSPACE_DETAIL = 'Saved browser data could not be read. Saving is paused to protect the original record.'
const UNSUPPORTED_WORKSPACE_DETAIL = 'This workspace uses an unsupported storage version. Saving is paused to protect it.'

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
  const [recovery, setRecovery] = useState<WorkspaceRecovery | null>(null)
  const hydratedRef = useRef(false)
  const touchedBeforeHydrationRef = useRef(false)
  const workspaceRef = useRef(workspace)
  const statusRef = useRef(status)
  const revisionRef = useRef(0)
  const pendingSaveRef = useRef<PendingWorkspaceSave | null>(null)
  const saveRunningRef = useRef(false)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const mountedRef = useRef(true)
  const persistenceBlockedRef = useRef(false)
  workspaceRef.current = workspace

  const setWorkspace: Dispatch<SetStateAction<StoredWorkspace>> = useCallback((update) => {
    if (!hydratedRef.current) touchedBeforeHydrationRef.current = true
    setWorkspaceState(update)
  }, [])

  const refreshUsage = useCallback(async () => {
    const nextUsage = await estimateStorageUsage()
    if (mountedRef.current) setUsage(nextUsage)
  }, [])

  const blockPersistenceForRecovery = useCallback((result: IndexedWorkspaceRead) => {
    if (result.kind !== 'corrupt' && result.kind !== 'unsupported-version') return
    persistenceBlockedRef.current = true
    pendingSaveRef.current = null
    revisionRef.current += 1
    const nextRecovery: WorkspaceRecovery = {
      kind: result.kind,
      raw: result.raw,
      preserved: result.preserved,
      ...(result.kind === 'unsupported-version' ? { version: result.version } : {}),
    }
    const nextStatus: WorkspaceStorageStatus = {
      phase: 'recovery',
      backend: 'indexeddb',
      detail: result.kind === 'unsupported-version'
        ? UNSUPPORTED_WORKSPACE_DETAIL
        : CORRUPT_WORKSPACE_DETAIL,
    }
    statusRef.current = nextStatus
    setRecovery(nextRecovery)
    setStatus(nextStatus)
  }, [])

  const runSaveQueue = useCallback(async () => {
    if (saveRunningRef.current) return
    saveRunningRef.current = true

    while (pendingSaveRef.current) {
      if (persistenceBlockedRef.current) {
        pendingSaveRef.current = null
        break
      }
      const { snapshot, revision } = pendingSaveRef.current
      pendingSaveRef.current = null
      let nextStatus: WorkspaceStorageStatus

      try {
        await writeIndexedWorkspace(snapshot)
        removeLegacyWorkspace()
        announceWorkspaceChange()
        channelRef.current?.postMessage({ type: 'workspace-changed' })
        nextStatus = { phase: 'saved', backend: 'indexeddb' }
      } catch {
        // Private browsing modes and restrictive browser settings can disable
        // IndexedDB. Retain the previous localStorage path as a fallback.
        try {
          writeLegacyWorkspace(snapshot)
          nextStatus = { phase: 'warning', backend: 'localstorage', detail: IDB_FALLBACK_DETAIL }
        } catch {
          nextStatus = { phase: 'error', backend: null, detail: SAVE_FAILED_DETAIL }
        }
      }

      if (mountedRef.current && revision === revisionRef.current) {
        statusRef.current = nextStatus
        setStatus(nextStatus)
        void refreshUsage()
      }
    }

    saveRunningRef.current = false
  }, [refreshUsage])

  const persist = useCallback((snapshot: StoredWorkspace) => {
    if (persistenceBlockedRef.current) return
    const revision = ++revisionRef.current
    pendingSaveRef.current = { snapshot, revision }
    const savingStatus = { ...statusRef.current, phase: 'saving' } satisfies WorkspaceStorageStatus
    statusRef.current = savingStatus
    setStatus(savingStatus)
    void runSaveQueue()
  }, [runSaveQueue])

  const flush = useCallback(async () => {
    // Never let an update-triggered flush persist the starter snapshot while
    // the IndexedDB workspace is still being read and merged.
    while (!hydratedRef.current && mountedRef.current) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 20))
    }
    if (!mountedRef.current) return statusRef.current
    if (persistenceBlockedRef.current) return statusRef.current
    persist(workspaceRef.current)
    while (saveRunningRef.current || pendingSaveRef.current) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 20))
    }
    return statusRef.current
  }, [persist])

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false
    const legacyRead = legacyReadRef.current

    void (async () => {
      let indexedRead: IndexedWorkspaceRead | null = null
      try {
        indexedRead = await readIndexedWorkspace()
      } catch {
        // The first save below will attempt localStorage if IndexedDB stays unavailable.
      }

      if (cancelled || !mountedRef.current) return
      if (indexedRead?.kind === 'corrupt' || indexedRead?.kind === 'unsupported-version') {
        hydratedRef.current = true
        blockPersistenceForRecovery(indexedRead)
        return
      }
      const indexedWorkspace = indexedRead?.kind === 'valid' ? indexedRead.workspace : null
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
  }, [blockPersistenceForRecovery, persist])

  useEffect(() => {
    if (!hydratedRef.current) return
    persist(workspace)
  }, [persist, workspace])

  useEffect(() => {
    async function mergeLatestIndexedWorkspace() {
      try {
        const incoming = await readIndexedWorkspace()
        if (!mountedRef.current) return
        if (incoming.kind === 'corrupt' || incoming.kind === 'unsupported-version') {
          blockPersistenceForRecovery(incoming)
          return
        }
        if (incoming.kind !== 'valid') return
        setWorkspaceState((current) => {
          const merged = mergeStoredWorkspaces(current, incoming.workspace)
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
  }, [blockPersistenceForRecovery])

  const replaceUnsafeWorkspace = useCallback(() => {
    if (!persistenceBlockedRef.current) return
    persistenceBlockedRef.current = false
    setRecovery(null)
    persist(workspaceRef.current)
  }, [persist])

  return {
    workspace,
    setWorkspace,
    status,
    usage,
    syncedAt,
    flush,
    recovery,
    replaceUnsafeWorkspace,
  }
}
