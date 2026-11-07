import { type CreateAppOptions, createApp, type KitrApp } from '@kitr/core'
import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

declare module '@kitr/core' {
  interface KitrNodeTypes {
    node: ReactNode
  }
}

const KitrContext = createContext<KitrApp | null>(null)

export interface KitrProviderProps {
  app: KitrApp
  children: ReactNode
}

/**
 * Puts the app in context and renders every provider's `wrap()` around children.
 * Boot the app first (`await app.boot()`) when you can; otherwise it suspends until boot completes.
 */
export function KitrProvider({ app, children }: KitrProviderProps) {
  // Not booted yet (TanStack Start calls getRouter() synchronously): suspend on the boot promise.
  // Boot is memoised, so every render that lands here waits on the same promise.
  if (app.status === 'created' || app.status === 'registered') throw app.boot()
  const tree = useMemo(() => app.wrap(children), [app, children])
  return <KitrContext.Provider value={app}>{tree as ReactNode}</KitrContext.Provider>
}

export function useApp(): KitrApp {
  const app = useContext(KitrContext)
  if (!app) throw new Error('[kitr/react] useApp() must be used inside <KitrProvider>.')
  return app
}

/** Read a container binding from a component. The binding must be resolved (it is after boot). */
export function useService<K extends Parameters<KitrApp['container']['use']>[0]>(key: K) {
  return useApp().container.use(key)
}

export function useConfig<K extends Parameters<KitrApp['config']['get']>[0]>(key: K) {
  return useApp().config.get(key)
}

/**
 * Boot an app inside React. Renders `fallback` until boot completes.
 * Use in client-only apps; server-rendered apps boot before rendering.
 */
export function KitrBoot({
  app,
  children,
  fallback = null,
}: KitrProviderProps & { fallback?: ReactNode }) {
  const [ready, setReady] = useState(app.status !== 'created')
  const [error, setError] = useState<unknown>(null)
  useEffect(() => {
    if (ready) return
    app.boot().then(() => setReady(true), setError)
  }, [app, ready])
  if (error) throw error
  if (!ready) return <>{fallback}</>
  return <KitrProvider app={app}>{children}</KitrProvider>
}

export type { CreateAppOptions, KitrApp }
export { createApp }
