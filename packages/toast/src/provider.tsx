import { defineProvider } from '@kitr/core'
import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ToastConfig } from './config'
import { setToastImplementation } from './toast'

type Sonner = typeof import('sonner')

/**
 * Sonner adds its stylesheet as a `<style>` tag when it loads and cannot be given a nonce, which a
 * page under a nonce-based Content-Security-Policy refuses. While it loads, `<style>` tags made by
 * `document.createElement` get the page's nonce (the `csp-nonce` meta tag TanStack Start renders).
 */
async function importSonner(): Promise<Sonner> {
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

/** Set when the provider boots in the browser. */
let sonner: Sonner | null = null

type Theme = 'light' | 'dark' | 'system'

/** `light` or `dark` from `data-theme` on <html>, which @kitr/theme sets; `system` without it. */
function readTheme(): Theme {
  const value = document.documentElement.getAttribute('data-theme')
  return value === 'light' || value === 'dark' ? value : 'system'
}

/**
 * Mounts sonner's toaster on `document.body` after the first render. Providers wrap the whole
 * tree, which in a Start app includes `<html>`, so the toaster cannot be a plain sibling of it.
 * Rendering nothing until mount also keeps server HTML and hydration identical.
 */
function BodyToaster({ config }: { config: ToastConfig }) {
  const [theme, setTheme] = useState<Theme | null>(null)
  useEffect(() => {
    setTheme(readTheme())
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])
  if (!theme || !sonner) return null
  const { Toaster } = sonner
  return createPortal(
    <Toaster
      theme={theme}
      position={config.position ?? 'bottom-right'}
      richColors={config.richColors ?? true}
      duration={config.duration}
      closeButton={config.closeButton}
    />,
    document.body,
  )
}

/**
 * Sends `toast` to sonner and mounts its toaster with `config/toast.ts`.
 * Listed in kitrrc.ts as `() => import('@kitr/toast/provider')`.
 */
export const toastProvider = defineProvider({
  name: 'toast',
  async boot() {
    if (typeof document === 'undefined') return
    sonner = await importSonner()
    setToastImplementation(sonner.toast as never)
  },
  wrap(children, app) {
    const config = app.config.get('toast', {} as ToastConfig)
    return (
      <>
        {children as ReactNode}
        <BodyToaster config={config} />
      </>
    )
  },
})

export default toastProvider
