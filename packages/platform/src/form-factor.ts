import { useApp } from '@kitr/react'
import { useEffect, useMemo, useState } from 'react'
import {
  createPlatform,
  type FormFactor,
  type FormFactorOptions,
  fallbackFormFactor,
  type PlatformConfig,
  readFormFactor,
} from './index'

/** The `formFactor` options from `config/platform.ts`, merged with the ones passed to the hook. */
function resolveOptions(
  config: PlatformConfig | undefined,
  options: FormFactorOptions | undefined,
): FormFactorOptions {
  return {
    breakpoints: { ...config?.formFactor?.breakpoints, ...options?.breakpoints },
    fallback: { ...config?.formFactor?.fallback, ...options?.fallback },
  }
}

/**
 * The viewport's form factor: width class (`compact` under 768px, `medium`, `expanded` from 1024px),
 * primary input (`touch` or `pointer`) and orientation. Hydration-safe: the server and the first
 * client render return the configured fallback with `ready: false`, then the real values arrive
 * after mount and follow window resizes and orientation changes.
 *
 * Layout decisions belong to `width`, affordances to `input`, platform idioms to `usePlatform()`:
 *
 *   const { width } = useFormFactor()
 *   return width === 'expanded' ? <SplitView /> : <Stack />
 */
export function useFormFactor(options?: FormFactorOptions): FormFactor {
  const app = useApp()
  // The service when the platform provider is registered, else the browser/server default.
  const platform = app.container.has('platform')
    ? app.container.use('platform')
    : createPlatform(app)
  const config = app.config.has('platform') ? app.config.get('platform') : undefined
  const medium = options?.breakpoints?.medium ?? config?.formFactor?.breakpoints?.medium
  const expanded = options?.breakpoints?.expanded ?? config?.formFactor?.breakpoints?.expanded
  const fallbackWidth = options?.fallback?.width ?? config?.formFactor?.fallback?.width
  const fallbackInput = options?.fallback?.input ?? config?.formFactor?.fallback?.input
  const fallbackOrientation =
    options?.fallback?.orientation ?? config?.formFactor?.fallback?.orientation
  const resolved = useMemo(
    () =>
      resolveOptions(config, {
        breakpoints: { medium, expanded },
        fallback: { width: fallbackWidth, input: fallbackInput, orientation: fallbackOrientation },
      }),
    [config, medium, expanded, fallbackWidth, fallbackInput, fallbackOrientation],
  )
  const [value, setValue] = useState<FormFactor>(() => fallbackFormFactor(platform, resolved))
  useEffect(() => {
    if (typeof window === 'undefined') return
    const next = () => readFormFactor(window, resolved)
    const update = () =>
      setValue((prev) => {
        const current = next()
        return sameFormFactor(prev, current) ? prev : current
      })
    update()
    window.addEventListener('resize', update)
    const pointer = window.matchMedia?.('(pointer: coarse)')
    const hover = window.matchMedia?.('(hover: hover)')
    pointer?.addEventListener?.('change', update)
    hover?.addEventListener?.('change', update)
    return () => {
      window.removeEventListener('resize', update)
      pointer?.removeEventListener?.('change', update)
      hover?.removeEventListener?.('change', update)
    }
  }, [resolved])
  return value
}

function sameFormFactor(a: FormFactor, b: FormFactor) {
  return (
    a.width === b.width &&
    a.input === b.input &&
    a.orientation === b.orientation &&
    a.ready === b.ready
  )
}
