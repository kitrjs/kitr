import { defineProvider } from '@kitr/core'
import { type ComponentType, lazy, type ReactNode, Suspense, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ThemeConfig } from './config'
import { ThemeConfigContext, ThemeProvider } from './theme'
import { setToastImplementation } from './toast'

type ToasterComponent = ComponentType<{ position?: string; richColors?: boolean }>

/**
 * Sonner adds its stylesheet as a `<style>` tag when it loads and cannot be given a nonce, which a
 * page under a nonce-based Content-Security-Policy refuses. While it loads, `<style>` tags made by
 * `document.createElement` get the page's nonce (the `csp-nonce` meta tag TanStack Start renders).
 */
async function importSonner() {
  const nonce =
    typeof document === 'undefined'
      ? undefined
      : document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.content
  if (!nonce) return import('sonner')
  const create = document.createElement
  document.createElement = function (
    this: Document,
    ...args: Parameters<Document['createElement']>
  ) {
    const element = create.apply(this, args)
    if (String(args[0]).toLowerCase() === 'style') element.nonce = nonce
    return element
  } as Document['createElement']
  try {
    return await import('sonner')
  } finally {
    document.createElement = create
  }
}

const Toaster = lazy(async (): Promise<{ default: ToasterComponent }> => {
  try {
    const sonner = await importSonner()
    setToastImplementation(sonner.toast as any)
    return { default: sonner.Toaster as unknown as ToasterComponent }
  } catch {
    return { default: () => null }
  }
})

/**
 * Renders children into `document.body` after mount only.
 *
 * Providers wrap the whole tree, which in a Start app includes `<html>`, so the toaster cannot be a
 * plain sibling of it. Rendering nothing until mount also keeps server HTML and hydration identical.
 */
function BodyPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
    ? createPortal(<Suspense fallback={null}>{children}</Suspense>, document.body)
    : null
}

/**
 * Wraps the app in ThemeProvider with `config/theme.ts` and mounts the toaster (sonner, if installed).
 * Listed in kitrrc.ts as `() => import('@kitr/theme/provider')`. Pair with `<ThemeScript />` in the document head.
 */
export const themeProvider = defineProvider({
  name: 'theme',
  wrap(children, app) {
    const config = app.config.get('theme', {} as ThemeConfig)
    return (
      <ThemeConfigContext.Provider value={config}>
        <ThemeProvider
          defaultTheme={config.default}
          storageKey={config.storageKey}
          attribute={config.attribute}
          colors={config.colors}
        >
          {children as ReactNode}
          <BodyPortal>
            <Toaster
              position={config.toaster?.position ?? 'bottom-right'}
              richColors={config.toaster?.richColors ?? true}
            />
          </BodyPortal>
        </ThemeProvider>
      </ThemeConfigContext.Provider>
    )
  },
})

export default themeProvider
