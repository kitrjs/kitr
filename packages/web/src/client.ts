import { useCallback, useEffect, useState } from 'react'

/**
 * Browser-side hooks of the web platform. Import from `kitr/web/client`.
 * Online status, app state and the rest live in `kitr/platform/react`, where every platform shares them.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Captures the browser's install prompt so the app can show its own button.
 * `canInstall` is false on browsers that do not fire the event (Safari) and after install.
 */
export function useInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])
  const install = useCallback(async () => {
    if (!event) return 'unavailable' as const
    await event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'accepted') setEvent(null)
    return outcome
  }, [event])
  return { canInstall: !!event, installed, install }
}

/**
 * Registers the service worker vite-plugin-pwa emits (`/sw.js`) and reports a waiting update.
 * With `registerType: 'prompt'`, call `update()` to activate it and reload.
 */
export function useServiceWorker(options: { path?: string; onNeedRefresh?: () => void } = {}) {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [offlineReady, setOfflineReady] = useState(false)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    let cancelled = false
    navigator.serviceWorker
      .register(options.path ?? '/sw.js')
      .then((reg) => {
        if (cancelled) return
        setRegistration(reg)
        if (reg.waiting) {
          setNeedRefresh(true)
          options.onNeedRefresh?.()
        }
        if (reg.active && !reg.waiting && !reg.installing) setOfflineReady(true)
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                setNeedRefresh(true)
                options.onNeedRefresh?.()
              } else setOfflineReady(true)
            }
          })
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [options.path, options.onNeedRefresh])
  const update = useCallback(() => {
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    })
  }, [registration])
  return { needRefresh, offlineReady, update, registration }
}
