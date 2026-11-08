import { type ParsedLocation, useRouter, useRouterState } from '@tanstack/react-router'
import { type CSSProperties, type ReactNode, useCallback, useMemo, useState } from 'react'
import { StackEngine } from './engine'
import { StackOutlet, type StackOutletProps } from './StackOutlet'

/** One tab: where it starts and which paths belong to it. */
export interface StackTab {
  /** Stable id, also the stack group. */
  id: string
  /** The path the tab opens the first time. */
  to: string
  label?: ReactNode
  icon?: ReactNode
  /** Paths that belong to this tab. Default: `to` and anything under it. */
  match?: string[] | ((pathname: string) => boolean)
}

/** What the tab bar render prop receives: the tabs, the current one, `select()` and `tabOf()`. */
export interface StackTabsRenderProps {
  tabs: StackTab[]
  /** The tab whose page shows. */
  current: StackTab | undefined
  /** Open a tab: its last page, or its root when it is already current. */
  select(tab: StackTab | string): void
  /** The tab a pathname belongs to. */
  tabOf(pathname: string): StackTab | undefined
}

/** Props of `<StackTabs>`: the tabs, the bar as a render prop, and the outlet's own options. */
export interface StackTabsProps
  extends Omit<StackOutletProps, 'groupOf' | 'engine' | 'onRootBack'> {
  tabs: StackTab[]
  /** The tab bar. Receives the tabs, the current one and `select()`. Rendered after the pages. */
  children: (props: StackTabsRenderProps) => ReactNode
  /** Where the bar goes. Default `bottom` (`top` for a desktop sidebar is yours to style). */
  placement?: 'top' | 'bottom'
  /**
   * Android back at the root of a tab other than the first goes to the first tab before exiting
   * (Material's "home tab" rule). Default true.
   */
  backToHome?: boolean
  className?: string
  style?: CSSProperties
}

const matcherOf = (tab: StackTab) => {
  if (typeof tab.match === 'function') return tab.match
  const prefixes = tab.match ?? [tab.to]
  return (pathname: string) =>
    prefixes.some(
      (p) => pathname === p || (p !== '/' && pathname.startsWith(p.endsWith('/') ? p : `${p}/`)),
    )
}

/**
 * `<StackTabs>`: tabs that each keep their own stack. Switching tabs shows where that tab was
 * left; tapping the current tab again pops it to its root; back inside a tab pops that tab's
 * pages. Routes decide which tab they belong to by path (`match`), so the same route tree serves
 * a tabbed phone app and a sidebar desktop app.
 */
export function StackTabs({
  tabs,
  children,
  placement = 'bottom',
  backToHome = true,
  className,
  style,
  ...outlet
}: StackTabsProps) {
  const router = useRouter()
  const matchers = useMemo(() => tabs.map((t) => [t, matcherOf(t)] as const), [tabs])
  const tabOf = useCallback(
    (pathname: string) => matchers.find(([, m]) => m(pathname))?.[0],
    [matchers],
  )
  const groupOf = useCallback(
    (location: ParsedLocation, _matches?: unknown) => tabOf(location.pathname)?.id ?? 'default',
    [tabOf],
  )
  const [engine] = useState(() => new StackEngine({ keepAlive: outlet.keepAlive, groupOf }))
  // `groupOf` closes over the tabs; keep the engine's copy current when they change.
  engine.options.groupOf = groupOf

  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const current = tabOf(pathname)

  const select = useCallback(
    (which: StackTab | string) => {
      const tab = typeof which === 'string' ? tabs.find((t) => t.id === which) : which
      if (!tab) return
      const stack = engine.stackOf(tab.id)
      const target = current?.id === tab.id ? stack[0] : stack.at(-1)
      engine.switchingTo = tab.id
      void router.navigate({ href: target?.href ?? tab.to })
    },
    [tabs, engine, current, router],
  )

  const onRootBack = useCallback(() => {
    const home = tabs[0]
    if (!backToHome || !home || !current || current.id === home.id) return undefined
    select(home)
    return true
  }, [tabs, backToHome, current, select])

  const bar = children({ tabs, current, select, tabOf })
  return (
    <div
      data-kitr-stack-tabs=""
      className={className}
      style={{
        display: 'flex',
        flexDirection: placement === 'top' ? 'column-reverse' : 'column',
        height: '100%',
        ...style,
      }}
    >
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <StackOutlet {...outlet} engine={engine} onRootBack={onRootBack} />
      </div>
      {bar}
    </div>
  )
}
