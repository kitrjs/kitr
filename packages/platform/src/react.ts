import { useApp } from '@kitr/react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Platform, SafeArea } from './index'

/** The `platform` service from the container. */
export function usePlatform(): Platform {
  return useApp().container.use('platform')
}

/** `true` while the device reports a connection. Hydration-safe: the server and first render say online. */
export function useOnline(): boolean {
  const platform = usePlatform()
  return useSyncExternalStore(
    (notify) => platform.onOnline(() => notify()),
    () => platform.isOnline(),
    () => true,
  )
}

/** Foreground (`true`) or background. Backed by Capacitor App on mobile, window focus on desktop, visibility on the web. */
export function useAppState(): boolean {
  const platform = usePlatform()
  const [active, setActive] = useState(true)
  useEffect(() => platform.onAppState(setActive), [platform])
  return active
}

/** Android hardware back button, desktop window close. Return nothing to let the default run. */
export function useBackButton(handler: (info: { canGoBack: boolean }) => void) {
  const platform = usePlatform()
  useEffect(() => platform.onBackButton(handler), [platform, handler])
}

/**
 * Deep links opened while the app runs. The handler gets the URL and the router path for it, with
 * the scheme, host and `deepLinkPrefixes` from `config/platform.ts` removed:
 *
 *   useDeepLink(useCallback((_url, path) => void navigate({ to: path }), [navigate]))
 */
export function useDeepLink(handler: (url: string, path: string) => void) {
  const platform = usePlatform()
  useEffect(
    () => platform.onDeepLink((url) => handler(url, platform.linkPath(url))),
    [platform, handler],
  )
}

/** Safe-area insets (notch, home indicator). Zero on the server and first render. */
export function useSafeArea(): SafeArea {
  const platform = usePlatform()
  const [area, setArea] = useState<SafeArea>({ top: 0, right: 0, bottom: 0, left: 0 })
  useEffect(() => {
    const update = () => setArea(platform.safeArea())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [platform])
  return area
}
