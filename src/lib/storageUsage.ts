const MEBIBYTE = 1024 * 1024

export type StoragePressure = 'ok' | 'warning' | 'critical'

export interface StorageUsage {
  usage: number
  quota: number
  ratio: number
  pressure: StoragePressure
}

export interface StoragePersistenceManager {
  persisted?: () => Promise<boolean>
  persist?: () => Promise<boolean>
}

export type StoragePersistenceCheck = 'persistent' | 'available' | 'unsupported' | 'error'
export type StoragePersistenceRequest = 'persistent' | 'denied' | 'unsupported' | 'error'

function browserStorageManager(): StoragePersistenceManager | undefined {
  if (typeof navigator === 'undefined') return undefined
  return navigator.storage
}

export async function checkStoragePersistence(
  manager: StoragePersistenceManager | undefined = browserStorageManager(),
): Promise<StoragePersistenceCheck> {
  if (!manager?.persisted || !manager.persist) return 'unsupported'
  try {
    return await manager.persisted() ? 'persistent' : 'available'
  } catch {
    return 'error'
  }
}

export async function requestStoragePersistence(
  manager: StoragePersistenceManager | undefined = browserStorageManager(),
): Promise<StoragePersistenceRequest> {
  if (!manager?.persisted || !manager.persist) return 'unsupported'
  try {
    return await manager.persist() ? 'persistent' : 'denied'
  } catch {
    return 'error'
  }
}

export function classifyStorageUsage(usage: number, quota: number): StorageUsage | null {
  if (!Number.isFinite(usage) || !Number.isFinite(quota) || usage < 0 || quota <= 0) return null
  const ratio = Math.min(1, usage / quota)
  const remaining = Math.max(0, quota - usage)
  const pressure: StoragePressure = ratio >= 0.9 || remaining <= 2 * MEBIBYTE
    ? 'critical'
    : ratio >= 0.75 || remaining <= 10 * MEBIBYTE
      ? 'warning'
      : 'ok'
  return { usage, quota, ratio, pressure }
}

export function formatStorageSize(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < MEBIBYTE) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * MEBIBYTE) return `${(bytes / MEBIBYTE).toFixed(bytes < 10 * MEBIBYTE ? 1 : 0)} MB`
  return `${(bytes / (1024 * MEBIBYTE)).toFixed(1)} GB`
}
