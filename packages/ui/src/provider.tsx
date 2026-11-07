import { defineProvider } from '@kitr/core'
import { type ComponentType, lazy, type ReactNode, Suspense, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { UiConfig } from './config'
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
 * plain sibling of it. Rendering nothing until mount also keeps server HTML and hydration identical:
 * no Suspense markers or extra nodes exist while React matches the markup.
 */
function BodyPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
    ? createPortal(<Suspense fallback={null}>{children}</Suspense>, document.body)
    : null
}

/**
 * Wraps the app in ThemeProvider and mounts the toaster (sonner, if installed).
 * Listed in `kitrrc.ts` as `() => import('@kitr/ui/provider')`.
 */
export const uiProvider = defineProvider({
  name: 'ui',
  wrap(children, app) {
    const config = app.config.get('ui', {} as UiConfig)
    return (
      <ThemeProvider
        defaultTheme={config.theme?.default}
        storageKey={config.theme?.storageKey}
        attribute={config.theme?.attribute}
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

export default uiProvider
