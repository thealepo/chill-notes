import { RefreshCw, Sparkles, X } from 'lucide-react'

interface PwaUpdateNoticeProps {
  updating: boolean
  onUpdate: () => void
  onDismiss: () => void
}

export function PwaUpdateNotice({ updating, onUpdate, onDismiss }: PwaUpdateNoticeProps) {
  return (
    <section className="pwa-update-notice" role="status" aria-labelledby="pwa-update-title">
      <span className="pwa-update-icon" aria-hidden="true"><Sparkles size={18} /></span>
      <span className="pwa-update-copy">
        <strong id="pwa-update-title">A fresh version is ready</strong>
        <span>Your notes stay on this device while Chill Notes updates.</span>
      </span>
      <button className="pwa-update-action" onClick={onUpdate} disabled={updating}>
        <RefreshCw size={15} className={updating ? 'is-spinning' : ''} />
        {updating ? 'Updating…' : 'Update now'}
      </button>
      <button className="icon-button pwa-update-dismiss" onClick={onDismiss} aria-label="Dismiss update">
        <X size={16} />
      </button>
    </section>
  )
}
