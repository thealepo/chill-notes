const isApplePlatform = typeof navigator !== 'undefined'
  && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)

/** Label for the primary shortcut modifier on the current platform. */
export const modKeyLabel = isApplePlatform ? '⌘' : 'Ctrl'

/**
 * Triggers a browser download for a Blob or data URL. The link is attached to
 * the document (required by some browsers) and object URLs are revoked only
 * after the click has been dispatched.
 */
export function downloadFile(source: Blob | string, filename: string) {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    if (typeof source !== 'string') window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
