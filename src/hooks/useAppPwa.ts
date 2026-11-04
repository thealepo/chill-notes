import { useCallback, useEffect, useRef, useState } from 'react'
import { usePwa } from './usePwa'
import type { WorkspaceStorageStatus } from './useWorkspaceStorage'

const UPDATE_SAVE_TIMEOUT = 10_000

interface UseAppPwaOptions {
  storageStatus: WorkspaceStorageStatus
  flushWorkspace: () => Promise<WorkspaceStorageStatus>
  notify: (message: string) => void
}

export function useAppPwa({ storageStatus, flushWorkspace, notify }: UseAppPwaOptions) {
  const pwa = usePwa()
  const {
    dismissOfflineReady,
    dismissUpdate,
    installMode,
    needRefresh,
    offlineReady,
    online,
    promptInstall,
    registrationFailed,
    reloadNeeded,
    reloadPage,
    updateServiceWorker,
  } = pwa
  const [updating, setUpdating] = useState(false)
  const previousOnlineRef = useRef(true)
  const reloadRunningRef = useRef(false)

  useEffect(() => {
    if (!offlineReady) return
    notify('Chill Notes is ready to use offline.')
    dismissOfflineReady()
  }, [dismissOfflineReady, notify, offlineReady])

  useEffect(() => {
    if (!registrationFailed) return
    notify('Offline setup is unavailable right now. Your notes still save on this device.')
  }, [notify, registrationFailed])

  useEffect(() => {
    if (previousOnlineRef.current === online) return
    previousOnlineRef.current = online
    notify(online ? 'Back online.' : 'You’re offline — your saved notes are still available.')
  }, [notify, online])

  const install = useCallback(async () => {
    try {
      const result = await promptInstall()
      if (result === 'accepted') notify('Chill Notes is being installed.')
      if (result === 'dismissed') notify('Installation cancelled. You can try again later.')
      if (result === 'manual') notify('In Safari, tap Share, then “Add to Home Screen.”')
      if (result === 'unavailable') notify('Install from your browser’s app menu when available.')
    } catch {
      notify('Could not open the install prompt. Try your browser’s app menu.')
    }
  }, [notify, promptInstall])

  const saveBeforeReload = useCallback(async () => {
    const savedStatus = await Promise.race([
      flushWorkspace(),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), UPDATE_SAVE_TIMEOUT)),
    ])
    if (!savedStatus) {
      notify('Update paused because saving is taking longer than expected. Try again in a moment.')
      return false
    }
    if (savedStatus.phase === 'error' || savedStatus.phase === 'recovery') {
      notify(savedStatus.phase === 'recovery'
        ? 'Update paused while saved data needs recovery. Download or replace it first.'
        : 'Update paused because your latest changes are not saved. Download a backup first.')
      return false
    }
    return true
  }, [flushWorkspace, notify])

  const update = useCallback(async () => {
    setUpdating(true)
    try {
      if (storageStatus.phase === 'loading' || storageStatus.phase === 'saving') {
        notify('Finishing saving before the update…')
      }
      if (!await saveBeforeReload()) {
        setUpdating(false)
        return
      }
      if (reloadNeeded) {
        reloadPage()
        return
      }
      await updateServiceWorker(true)
    } catch {
      setUpdating(false)
      notify('Could not update right now. Your current version is still available.')
    }
  }, [notify, reloadNeeded, reloadPage, saveBeforeReload, storageStatus.phase, updateServiceWorker])

  useEffect(() => {
    if (!reloadNeeded || reloadRunningRef.current) return
    reloadRunningRef.current = true
    setUpdating(true)
    void saveBeforeReload().then((canReload) => {
      if (canReload) {
        reloadPage()
        return
      }
      reloadRunningRef.current = false
      setUpdating(false)
    })
  }, [reloadNeeded, reloadPage, saveBeforeReload])

  return {
    installMode,
    needRefresh,
    updating,
    install,
    update,
    dismissUpdate,
  }
}
