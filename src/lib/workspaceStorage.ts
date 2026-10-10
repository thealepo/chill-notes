import {
  normalizeStoredWorkspace,
  serializeStoredWorkspace,
  type StoredWorkspace,
} from './noteSerialization'
import { classifyStorageUsage, type StorageUsage } from './storageUsage'

export const LEGACY_WORKSPACE_KEY = 'chill-notes-v1'
export const CORRUPT_WORKSPACE_BACKUP_KEY = 'chill-notes-v1-unreadable-backup'
export const WORKSPACE_SYNC_KEY = 'chill-notes-workspace-sync'
export const WORKSPACE_CHANNEL_NAME = 'chill-notes-workspace'

const DATABASE_NAME = 'chill-notes'
const DATABASE_VERSION = 1
const WORKSPACE_STORE = 'workspace'
const CURRENT_WORKSPACE_KEY = 'current'
let databasePromise: Promise<IDBDatabase> | null = null

export interface LegacyWorkspaceRead {
  workspace: StoredWorkspace | null
  storageAvailable: boolean
  unreadableDataPreserved: boolean
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function openWorkspaceDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(WORKSPACE_STORE)) {
        database.createObjectStore(WORKSPACE_STORE)
      }
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        databasePromise = null
      }
      resolve(database)
    }
    request.onerror = () => {
      databasePromise = null
      reject(request.error ?? new Error('Could not open IndexedDB.'))
    }
    request.onblocked = () => {
      databasePromise = null
      reject(new Error('IndexedDB upgrade was blocked by another tab.'))
    }
  })

  return databasePromise
}

function parseWorkspace(value: unknown): StoredWorkspace | null {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    const workspace = normalizeStoredWorkspace(parsed)
    return workspace.notes.length > 0 ? workspace : null
  } catch {
    return null
  }
}

export function readLegacyWorkspace(): LegacyWorkspaceRead {
  let saved: string | null

  try {
    saved = localStorage.getItem(LEGACY_WORKSPACE_KEY)
  } catch {
    return { workspace: null, storageAvailable: false, unreadableDataPreserved: false }
  }

  if (!saved) {
    return { workspace: null, storageAvailable: true, unreadableDataPreserved: false }
  }

  const workspace = parseWorkspace(saved)
  if (workspace) {
    return { workspace, storageAvailable: true, unreadableDataPreserved: false }
  }

  let unreadableDataPreserved = false
  try {
    localStorage.setItem(CORRUPT_WORKSPACE_BACKUP_KEY, saved)
    unreadableDataPreserved = true
  } catch {
    // Storage can be unavailable or too full to preserve another copy.
  }

  return { workspace: null, storageAvailable: true, unreadableDataPreserved }
}

export async function readIndexedWorkspace(): Promise<StoredWorkspace | null> {
  const database = await openWorkspaceDatabase()
  const transaction = database.transaction(WORKSPACE_STORE, 'readonly')
  const stored = await requestResult(transaction.objectStore(WORKSPACE_STORE).get(CURRENT_WORKSPACE_KEY))
  return parseWorkspace(stored)
}

export async function writeIndexedWorkspace(workspace: StoredWorkspace): Promise<void> {
  const database = await openWorkspaceDatabase()
  const transaction = database.transaction(WORKSPACE_STORE, 'readwrite')
  const completed = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'))
  })
  transaction.objectStore(WORKSPACE_STORE).put(
    serializeStoredWorkspace(workspace),
    CURRENT_WORKSPACE_KEY,
  )
  await completed
}

export function writeLegacyWorkspace(workspace: StoredWorkspace): void {
  localStorage.setItem(LEGACY_WORKSPACE_KEY, serializeStoredWorkspace(workspace))
}

export function removeLegacyWorkspace(): void {
  try {
    localStorage.removeItem(LEGACY_WORKSPACE_KEY)
  } catch {
    // IndexedDB is already durable; failure to reclaim legacy storage is harmless.
  }
}

export function announceWorkspaceChange(): void {
  try {
    localStorage.setItem(WORKSPACE_SYNC_KEY, `${Date.now()}:${crypto.randomUUID()}`)
  } catch {
    // BroadcastChannel remains the primary cross-tab notification path.
  }
}

export async function estimateStorageUsage(): Promise<StorageUsage | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const estimate = await navigator.storage.estimate()
    return classifyStorageUsage(estimate.usage ?? Number.NaN, estimate.quota ?? Number.NaN)
  } catch {
    return null
  }
}
