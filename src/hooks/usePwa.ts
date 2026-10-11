import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

type InstallChoice = 'accepted' | 'dismissed'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: InstallChoice; platform: string }>
  prompt: () => Promise<void>
}

export type PwaInstallMode = 'native' | 'ios' | 'none'
export type PwaInstallResult = InstallChoice | 'manual' | 'unavailable'

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true
}

function isIosDevice() {
  const navigatorWithPlatform = navigator as Navigator & { platform?: string }
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigatorWithPlatform.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function usePwa() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [registrationFailed, setRegistrationFailed] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW: (_scriptUrl, nextRegistration) => setRegistration(nextRegistration ?? null),
    onRegisterError: () => setRegistrationFailed(true),
  })

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')

    function handleInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    function handleInstalled() {
      setInstalled(true)
      setInstallPrompt(null)
    }

    function handleDisplayModeChange() {
      setInstalled(isStandalone())
    }

    function handleOnline() {
      setOnline(true)
    }

    function handleOffline() {
      setOnline(false)
    }

    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    displayMode.addEventListener('change', handleDisplayModeChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      displayMode.removeEventListener('change', handleDisplayModeChange)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.displayMode = installed ? 'standalone' : 'browser'
  }, [installed])

  useEffect(() => {
    if (!registration) return

    function checkForUpdate() {
      if (navigator.onLine) void registration?.update().catch(() => undefined)
    }

    const interval = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL)
    window.addEventListener('online', checkForUpdate)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', checkForUpdate)
    }
  }, [registration])

  const installMode = useMemo<PwaInstallMode>(() => {
    if (installed) return 'none'
    if (installPrompt) return 'native'
    return isIosDevice() ? 'ios' : 'none'
  }, [installPrompt, installed])

  const promptInstall = useCallback(async (): Promise<PwaInstallResult> => {
    if (!installPrompt) return installMode === 'ios' ? 'manual' : 'unavailable'
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)
    return choice.outcome
  }, [installMode, installPrompt])

  const dismissOfflineReady = useCallback(() => setOfflineReady(false), [setOfflineReady])
  const dismissUpdate = useCallback(() => setNeedRefresh(false), [setNeedRefresh])

  return {
    installMode,
    installed,
    online,
    registrationFailed,
    offlineReady,
    needRefresh,
    promptInstall,
    updateServiceWorker,
    dismissOfflineReady,
    dismissUpdate,
  }
}
