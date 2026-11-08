import { type DevtoolsPanel, defineProvider } from '@kitr/core'
import { lazy, type ReactNode, Suspense, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createDevtoolsHub, type DevtoolsConfig } from './index'

const Overlay = lazy(() => import('./overlay').then((m) => ({ default: m.DevtoolsOverlay })))

/**
 * Mounts the overlay into `document.body` after hydration. Providers wrap the whole tree, `<html>`
 * included in a Start app, so the overlay cannot be a sibling of it, and rendering nothing during
 * hydration keeps the client tree identical to the server's (which never renders devtools).
 */
function BodyPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
    ? createPortal(<Suspense fallback={null}>{children}</Suspense>, document.body)
    : null
}

/** `enabled` from config/devtools.ts, defaulting to development. */
function enabled(app: { isDevelopment: boolean; config: { get: any } }): boolean {
  return app.config.get('devtools', {} as DevtoolsConfig).enabled ?? app.isDevelopment
}

function active(app: { isDevelopment: boolean; isClient: boolean; config: { get: any } }) {
  return app.isClient && enabled(app)
}

/**
 * Binds the `devtools` hub, collects every provider's `devtools()` panels and mounts the overlay,
 * when `enabled` (default: development). Otherwise `register`/`wrap` are no-ops, and in a
 * production build the kitr Vite plugin leaves this module out unless the config enables it.
 */
export const devtoolsProvider = defineProvider({
  name: 'devtools',
  register(app) {
    if (!active(app)) return
    const config = app.config.get('devtools', {} as DevtoolsConfig)
    app.container.value('devtools', createDevtoolsHub({ maxEntries: config.maxEntries }))
  },
  async boot(app) {
    if (!active(app)) return
    const hub = app.container.use('devtools')
    const { builtinPanels } = await import('./panels')
    for (const panel of builtinPanels()) hub.register(panel)
    const contributions = await Promise.all(
      app.providers.map(async (p) => {
        try {
          return (await p.devtools?.(app)) ?? []
        } catch (e) {
          hub.log('devtools', `${p.name}: devtools() failed`, e, 'error')
          return [] as DevtoolsPanel[]
        }
      }),
    )
    for (const panel of contributions.flat()) hub.register(panel)
  },
  wrap(children, app) {
    // Same tree shape on the server and the client (useId depends on it); the portal mounts client-side only.
    if (!enabled(app)) return children
    return (
      <>
        {children as ReactNode}
        <BodyPortal>
          <Overlay app={app} />
        </BodyPortal>
      </>
    )
  },
})

export default devtoolsProvider
