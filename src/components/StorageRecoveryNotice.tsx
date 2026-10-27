import { AlertTriangle, Download, HardDrive, RotateCcw } from 'lucide-react'
import type { WorkspaceRecovery, WorkspaceStorageStatus } from '../hooks/useWorkspaceStorage'
import { formatStorageSize, type StorageUsage } from '../lib/storageUsage'

interface StorageRecoveryNoticeProps {
  status: WorkspaceStorageStatus
  usage: StorageUsage | null
  recovery: WorkspaceRecovery | null
  onDownloadBackup: () => void
  onDownloadRecovery: () => void
  onReplaceWorkspace: () => void
}

function storageUsageLabel(usage: StorageUsage): string {
  return `${formatStorageSize(usage.usage)} of ${formatStorageSize(usage.quota)} used`
}

export function StorageRecoveryNotice({
  status,
  usage,
  recovery,
  onDownloadBackup,
  onDownloadRecovery,
  onReplaceWorkspace,
}: StorageRecoveryNoticeProps) {
  if (recovery) {
    const unsupported = recovery.kind === 'unsupported-version'
    const versionLabel = recovery.version === null || recovery.version === undefined
      ? ''
      : ` (version ${recovery.version})`
    const detail = unsupported
      ? `This workspace was saved with an unsupported data format${versionLabel}. Saving is paused so it cannot be replaced.`
      : 'The saved workspace could not be read. Saving is paused so the original data cannot be replaced.'

    return (
      <section
        className="storage-recovery-notice is-critical is-data-recovery"
        role="alert"
        aria-labelledby="storage-recovery-title"
      >
        <span className="storage-recovery-icon" aria-hidden="true">
          <AlertTriangle size={18} />
        </span>
        <span className="storage-recovery-copy">
          <strong id="storage-recovery-title">
            {unsupported ? 'This saved workspace needs a newer version' : 'Saved workspace needs recovery'}
          </strong>
          <span>{detail}</span>
        </span>
        <span className="storage-recovery-actions">
          <button onClick={onDownloadRecovery}>
            <Download size={15} />
            Download original data
          </button>
          <button className="storage-recovery-replace" onClick={onReplaceWorkspace}>
            <RotateCcw size={15} />
            Replace saved data
          </button>
        </span>
      </section>
    )
  }

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
