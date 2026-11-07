import { type CreateAppOptions, createApp, type KitrApp } from '@kitr/core'
import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

declare module '@kitr/core' {
  interface KitrNodeTypes {
    node: ReactNode
  }
}

const KitrContext = createContext<KitrApp | null>(null)

/** Props of `KitrProvider` and `KitrBoot`: the app to put in context and the tree that reads it. */
export interface KitrProviderProps {
  /** The app from `app/app.ts`. Every provider's `wrap()` is rendered around `children`. */
  app: KitrApp
  /** The tree that can call `useApp`, `useService` and `useConfig`. */
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

/**
 * The app in context: its container, config, env, mode, environment and platform.
 * Throws when the component is not rendered inside `KitrProvider` (or `KitrBoot`, or the router).
 */
export function useApp(): KitrApp {
  const app = useContext(KitrContext)
  if (!app) throw new Error('[kitr/react] useApp() must be used inside <KitrProvider>.')
  return app
}

/**
 * Read a container binding from a component, typed from `ContainerBindings` (`useService('http')`).
 * The binding must be resolved, which it is after boot; an unknown key throws.
 */
export function useService<K extends Parameters<KitrApp['container']['use']>[0]>(key: K) {
  return useApp().container.use(key)
}

/**
 * Read one package's config, as exported by `config/<name>.ts`, typed from `ConfigRegistry`.
 * Throws when that config does not exist; use `useApp().config.get(key, fallback)` for optional config.
 */
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

// createApp, CreateAppOptions and KitrApp are documented where they are declared, in @kitr/core.
export type { CreateAppOptions, KitrApp }
export { createApp }
