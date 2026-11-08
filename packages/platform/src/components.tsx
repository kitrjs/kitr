import type { PlatformName } from '@kitr/core'
import type { ReactNode } from 'react'
import { useFormFactor } from './form-factor'
import type { InputKind, Orientation, PlatformOs, PlatformType, WidthClass } from './index'
import { usePlatform } from './react'

type OneOrMany<T> = T | readonly T[]

/**
 * What `<Only>` and `<Except>` match on. Every prop is optional and all given props must match
 * (a logical AND). An array matches any of its values.
 */
export interface PlatformMatch {
  /** A platform name from kitrrc.ts: `'phone'`, or `['phone', 'tablet']`. Typed after `kitr types`. */
  platform?: OneOrMany<PlatformName>
  /** The platform type the active driver reports: `'mobile'`, `'desktop'`, `'web'`, `'server'`. */
  type?: OneOrMany<PlatformType>
  /** The operating system: `'ios'`, `'android'`, `'macos'`... */
  os?: OneOrMany<PlatformOs | (string & {})>
  /** `true` inside a native shell (Capacitor, Electron, Tauri), `false` in a plain browser. */
  native?: boolean
  /** The viewport width class from `useFormFactor()`. */
  width?: OneOrMany<WidthClass>
  /** The primary input from `useFormFactor()`. */
  input?: OneOrMany<InputKind>
  /** The orientation from `useFormFactor()`. */
  orientation?: OneOrMany<Orientation>
}

/** Props of `<Only>` and `<Except>`: the platform match plus `children` and `fallback`. */
export interface OnlyProps extends PlatformMatch {
  children?: ReactNode
  /** Rendered when the match fails. Default: nothing. */
  fallback?: ReactNode
}

const has = <T,>(wanted: OneOrMany<T> | undefined, actual: T) =>
  wanted === undefined || (Array.isArray(wanted) ? wanted.includes(actual) : wanted === actual)

/** Whether the current platform and form factor satisfy a `PlatformMatch`. The hook behind `<Only>` and `<Except>`. */
export function usePlatformMatch(match: PlatformMatch): boolean {
  const platform = usePlatform()
  const form = useFormFactor()
  return (
    has(match.platform, platform.name as PlatformName) &&
    has(match.type, platform.type) &&
    has(match.os, platform.os) &&
    (match.native === undefined || match.native === platform.native) &&
    has(match.width, form.width) &&
    has(match.input, form.input) &&
    has(match.orientation, form.orientation)
  )
}

/**
 * Render children only on the platforms, OS, shells or form factors given:
 *
 *   <Only platform="phone"><TabBar /></Only>
 *   <Only width="expanded" input="pointer" fallback={<MobileNav />}><SideRail /></Only>
 *
 * `platform` is typed against the names in kitrrc.ts once `kitr types` has run. Width, input and
 * orientation come from `useFormFactor()`, so they are hydration-safe: the first render uses the
 * configured fallback. This hides at run time; to keep code out of a platform's bundle, branch on
 * `platformName()` or `import.meta.env.KITR_PLATFORM` instead.
 */
export function Only({ children, fallback = null, ...match }: OnlyProps) {
  return <>{usePlatformMatch(match) ? children : fallback}</>
}

/** The inverse of `<Only>`: render children everywhere the match fails. */
export function Except({ children, fallback = null, ...match }: OnlyProps) {
  return <>{usePlatformMatch(match) ? fallback : children}</>
}
