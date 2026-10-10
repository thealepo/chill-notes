import { AlertTriangle, Download, HardDrive } from 'lucide-react'
import type { WorkspaceStorageStatus } from '../hooks/useWorkspaceStorage'
import { formatStorageSize, type StorageUsage } from '../lib/storageUsage'

interface StorageRecoveryNoticeProps {
  status: WorkspaceStorageStatus
  usage: StorageUsage | null
  onDownloadBackup: () => void
}

function storageUsageLabel(usage: StorageUsage): string {
  return `${formatStorageSize(usage.usage)} of ${formatStorageSize(usage.quota)} used`
}

export function StorageRecoveryNotice({
  status,
  usage,
  onDownloadBackup,
}: StorageRecoveryNoticeProps) {
  const storagePressure = usage?.pressure ?? 'ok'
  const severity = status.phase === 'error' || storagePressure === 'critical'
    ? 'critical'
    : status.phase === 'warning' || storagePressure === 'warning'
      ? 'warning'
      : null

  if (!severity) return null

  const title = status.phase === 'error'
    ? 'Your latest changes are not saved'
    : storagePressure === 'critical'
      ? 'Browser storage is almost full'
      : storagePressure === 'warning'
        ? 'Browser storage is getting full'
        : 'Limited browser storage is in use'
  const detail = status.detail ?? (usage ? `${storageUsageLabel(usage)}. Download a backup before adding more drawings.` : '')

  return (
    <section
      className={`storage-recovery-notice is-${severity}`}
      role={severity === 'critical' ? 'alert' : 'status'}
      aria-labelledby="storage-recovery-title"
    >
      <span className="storage-recovery-icon" aria-hidden="true">
        {severity === 'critical' ? <AlertTriangle size={18} /> : <HardDrive size={18} />}
      </span>
      <span className="storage-recovery-copy">
        <strong id="storage-recovery-title">{title}</strong>
        {detail && <span>{detail}</span>}
      </span>
      <button onClick={onDownloadBackup}>
        <Download size={15} />
        Download backup
      </button>
    </section>
  )
}
