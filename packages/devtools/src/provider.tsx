import { type DevtoolsPanel, defineProvider } from '@kitr/core'
import { lazy, type ReactNode, Suspense } from 'react'
import { createDevtoolsHub, type DevtoolsConfig } from './index'

const Overlay = lazy(() => import('./overlay').then((m) => ({ default: m.DevtoolsOverlay })))

function active(app: { isDevelopment: boolean; isClient: boolean; config: { get: any } }) {
  const config = app.config.get('devtools', {} as DevtoolsConfig)
  return config.enabled ?? (app.isDevelopment && app.isClient)
}

/**
 * Development only. Binds the `devtools` hub, collects every provider's `devtools()` panels
 * and mounts the overlay. In production `register`/`wrap` are no-ops, and the kitr Vite plugin
 * aliases this module away entirely so nothing of it ships.
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
    if (!active(app)) return children
    return (
      <>
        {children as ReactNode}
        <Suspense fallback={null}>
          <Overlay app={app} />
        </Suspense>
      </>
    )
  },
})

export default devtoolsProvider
