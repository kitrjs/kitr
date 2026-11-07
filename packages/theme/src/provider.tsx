import { defineProvider } from '@kitr/core'
import { type ComponentType, lazy, type ReactNode, Suspense, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ThemeConfig } from './config'
import { ThemeProvider } from './theme'
import { setToastImplementation } from './toast'

type ToasterComponent = ComponentType<{ position?: string; richColors?: boolean }>

const Toaster = lazy(async (): Promise<{ default: ToasterComponent }> => {
  try {
    const sonner = await import('sonner')
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
    )
  },
})

export default themeProvider
