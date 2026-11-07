import { defineProvider } from '@kitr/core'
import { type ComponentType, lazy, type ReactNode, Suspense } from 'react'
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
        {typeof window !== 'undefined' ? (
          <Suspense fallback={null}>
            <Toaster
              position={config.toaster?.position ?? 'bottom-right'}
              richColors={config.toaster?.richColors ?? true}
            />
          </Suspense>
        ) : null}
      </ThemeProvider>
    )
  },
})

export default uiProvider
