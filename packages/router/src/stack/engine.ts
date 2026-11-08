import type { AnyRouteMatch, ParsedLocation } from '@tanstack/react-router'

/**
 * How a page arrives when it is pushed on the stack.
 * - `push`: slides in from the side; the page below stays mounted and slides back out on pop.
 * - `cover`: rises from the bottom over the whole screen, dismissed by dragging down (a composer, a player).
 * - `sheet`: rises from the bottom over a dimmed page that stays visible (a picker, a menu).
 * - `fullscreen`: like `push` but with no swipe-back gesture (a video, a camera).
 */
export type Presentation = 'push' | 'cover' | 'sheet' | 'fullscreen'

/**
 * Route options the stack reads from `staticData`. Declare them on a route:
 *
 *   export const Route = createFileRoute('/post/new')({ staticData: { presentation: 'cover' } })
 */
export interface StackRouteOptions {
  /** How the page arrives. Default `push`. */
  presentation?: Presentation
  /** Keep this page mounted (state, scroll, media) under later pages. Default: the outlet's `keepAlive`. */
  keepAlive?: boolean
  /**
   * The page a cold start lands under: opening `/chats/5` from a notification puts `/chats` beneath
   * it so swipe back and the back button have somewhere to go. A pathname (`/chats`).
   */
  stackParent?: string
}

/** Where a page is in its life: arriving, in front, under another page, or on its way out. */
export type EntryPhase = 'entering' | 'active' | 'covered' | 'leaving'

/** One page in the stack: its history key and index, route ids, presentation and last matches. */
export interface StackEntry {
  /** Stable, unique per page instance: React's key. */
  id: string
  /** The history entry key (`location.state.key`) of this page's latest visit. */
  key: string
  /** The history index (`location.state.__TSR_index`) of that visit. */
  index: number
  href: string
  pathname: string
  /** The route ids below the outlet's route, outermost first. */
  routeIds: string[]
  presentation: Presentation
  /** Whether the page stays mounted under later pages. */
  keepAlive: boolean
  /** The tab (or `'default'`) the page belongs to. */
  group: string
  phase: EntryPhase
  /** The page's matches at its last visit, outlet route excluded, with the ancestors in front. */
  matches: AnyRouteMatch[]
  location: ParsedLocation
}

export type TransitionKind = 'push' | 'pop' | 'replace' | 'switch'

/** One move the view animates: what comes to the front, what leaves, and how. */
export interface StackTransition {
  id: number
  kind: TransitionKind
  /** The page coming to the front. */
  to: string
  /** The page it replaces at the front, if any. */
  from?: string
  /** The pages leaving the stack; removed once `finishLeaving()` is called for them. */
  leaving: string[]
  /** Whether the group (tab) changed. */
  groupChanged: boolean
  /** False when the move was already shown (a completed swipe gesture) and needs no animation. */
  animate: boolean
}

/** Options of `StackEngine` and `<StackOutlet>`: the keep-alive limit and how locations group into tabs. */
export interface StackEngineOptions {
  /** How many covered pages stay mounted per group. `false` keeps none (every page remounts on back). Default 5. */
  keepAlive?: number | false
  /** The tab a location belongs to. Default: one group. */
  groupOf?: (location: ParsedLocation, matches: AnyRouteMatch[]) => string
}

/** A committed router state for `StackEngine.apply()`: the matches, the location and the outlet's route. */
export interface ApplyInput {
  /** The live router's matches, root first. */
  matches: AnyRouteMatch[]
  location: ParsedLocation
  /** The id of the route whose outlet this is; pages are the matches below it. */
  outletRouteId: string
}

let nextEntryId = 0 // kitr-allow-module-state: only makes ids unique; sharing it between apps cannot collide
let nextTransitionId = 0 // kitr-allow-module-state: only makes ids unique; sharing it between apps cannot collide

const indexOf = (location: ParsedLocation): number | undefined => {
  const state = location.state as { __TSR_index?: number } | undefined
  return typeof state?.__TSR_index === 'number' ? state.__TSR_index : undefined
}

const keyOf = (location: ParsedLocation): string => {
  const state = location.state as { key?: string; __TSR_key?: string } | undefined
  return state?.__TSR_key ?? state?.key ?? location.href
}

/** The stack options of a page: the innermost route's `staticData` wins, then its parents below the outlet. */
export function stackOptionsOf(pageMatches: AnyRouteMatch[]): StackRouteOptions {
  const out: StackRouteOptions = {}
  for (const match of pageMatches) {
    const data = (match.staticData ?? {}) as StackRouteOptions
    if (data.presentation !== undefined) out.presentation = data.presentation
    if (data.keepAlive !== undefined) out.keepAlive = data.keepAlive
    if (data.stackParent !== undefined) out.stackParent = data.stackParent
  }
  return out
}

/**
 * The stack's state machine, free of React and the DOM so it can be tested on its own. Feed it
 * every committed router state with `apply()`; it decides whether that was a push, a pop, a
 * replace or a tab switch, keeps the pages in order with their last matches, and tells the view
 * what to animate. The view reports the end of leave animations with `finishLeaving()`.
 */
export class StackEngine {
  entries: StackEntry[] = []
  activeId: string | undefined
  transition: StackTransition | undefined
  private listeners = new Set<() => void>()
  private fallbackIndex = 0
  /** Set by the tabs view before navigating to a tab's last page: that push reuses the page instead of stacking a copy. */
  switchingTo: string | undefined
  /** Set by a completed swipe gesture: the next pop needs no leave animation. */
  gesturePopped: string | undefined
  readonly options: Required<StackEngineOptions>

  constructor(options: StackEngineOptions = {}) {
    this.options = {
      keepAlive: options.keepAlive ?? 5,
      groupOf: options.groupOf ?? (() => 'default'),
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    for (const l of [...this.listeners]) l()
  }

  get active(): StackEntry | undefined {
    return this.entries.find((e) => e.id === this.activeId)
  }

  byId(id: string): StackEntry | undefined {
    return this.entries.find((e) => e.id === id)
  }

  /** The pages of one group that are not leaving, bottom first. */
  stackOf(group: string): StackEntry[] {
    return this.entries
      .filter((e) => e.group === group && e.phase !== 'leaving')
      .sort((a, b) => a.index - b.index)
  }

  /** The topmost page of a group that is not leaving. */
  topOf(group: string): StackEntry | undefined {
    return this.stackOf(group).at(-1)
  }

  /** How many pages the active group holds (what "can go back" means to the stack). */
  get depth(): number {
    const active = this.active
    return active ? this.stackOf(active.group).length : 0
  }

  /** Whether a page should be in the tree: entering, active, leaving, or covered and kept alive within the limit. */
  isMounted(entry: StackEntry): boolean {
    if (entry.phase !== 'covered') return true
    if (!entry.keepAlive || this.options.keepAlive === false) return false
    const stack = this.stackOf(entry.group)
    const position = stack.length - 1 - stack.indexOf(entry)
    return position <= this.options.keepAlive
  }

  /** Apply a committed router state. Returns the transition to show, or undefined when the current page only refreshed. */
  apply(input: ApplyInput): StackTransition | undefined {
    const { matches, location, outletRouteId } = input
    const outletIndex = matches.findIndex((m) => m.routeId === outletRouteId)
    if (outletIndex < 0) return undefined
    const pageMatches = matches.slice(outletIndex + 1)
    if (!pageMatches.length) return undefined
    const key = keyOf(location)
    const index = indexOf(location) ?? this.fallbackIndex++
    const routeIds = pageMatches.map((m) => m.routeId)
    const active = this.active
    const existing = this.entries.find((e) => e.key === key && e.phase !== 'leaving')

    // The current page: a loader refetch, a search change in place, a replace to the same key.
    if (existing && existing.id === this.activeId) {
      this.refresh(existing, { matches, location, routeIds, index, pageMatches })
      this.notify()
      return undefined
    }

    const group = this.options.groupOf(location, matches)
    let transition: StackTransition

    if (existing) {
      // Back (or forward) to a page we still hold: every page above it leaves.
      this.refresh(existing, { matches, location, routeIds, index, pageMatches })
      const leaving = this.entries.filter((e) => e.index > index && e.phase !== 'leaving')
      transition = this.begin('pop', existing, active, leaving, group)
    } else if (!active || index > active.index) {
      const reuse =
        this.switchingTo === group
          ? this.stackOf(group).findLast((e) => e.pathname === location.pathname)
          : undefined
      if (reuse) {
        // A tab switch to a page that tab already holds (its last page, or its root when the
        // current tab is tapped again): reuse it rather than stacking a copy. Pages above it leave.
        const above = this.stackOf(group).filter((e) => e.index > reuse.index)
        this.refresh(reuse, { matches, location, routeIds, index, pageMatches })
        transition = this.begin('switch', reuse, active, above, group)
      } else {
        const entry = this.create({ key, index, routeIds, matches, location, pageMatches, group })
        const leaving = this.entries.filter(
          (e) => e !== entry && e.index >= index && e.phase !== 'leaving',
        )
        this.entries.push(entry)
        transition = this.begin('push', entry, active, leaving, group)
      }
    } else if (index === active.index) {
      // Same history slot, new page: a `replace` navigation.
      const entry = this.create({ key, index, routeIds, matches, location, pageMatches, group })
      this.entries.splice(this.entries.indexOf(active), 0, entry)
      transition = this.begin('replace', entry, active, [active], group)
    } else {
      // Back to a page we never held (the app started mid-history): it appears beneath, the current page leaves.
      const entry = this.create({ key, index, routeIds, matches, location, pageMatches, group })
      this.entries.splice(this.entries.indexOf(active), 0, entry)
      const leaving = this.entries.filter(
        (e) => e !== entry && e.index > index && e.phase !== 'leaving',
      )
      transition = this.begin('pop', entry, active, leaving, group)
    }
    this.switchingTo = undefined
    this.notify()
    return transition
  }

  private create(init: {
    key: string
    index: number
    routeIds: string[]
    matches: AnyRouteMatch[]
    location: ParsedLocation
    pageMatches: AnyRouteMatch[]
    group: string
  }): StackEntry {
    const options = stackOptionsOf(init.pageMatches)
    return {
      id: `stack-${++nextEntryId}`,
      key: init.key,
      index: init.index,
      href: init.location.href,
      pathname: init.location.pathname,
      routeIds: init.routeIds,
      presentation: options.presentation ?? 'push',
      keepAlive: options.keepAlive ?? true,
      group: init.group,
      phase: 'entering',
      matches: init.matches,
      location: init.location,
    }
  }

  private refresh(
    entry: StackEntry,
    next: {
      matches: AnyRouteMatch[]
      location: ParsedLocation
      routeIds: string[]
      index: number
      pageMatches: AnyRouteMatch[]
    },
  ) {
    const options = stackOptionsOf(next.pageMatches)
    entry.key = keyOf(next.location)
    entry.index = next.index
    entry.href = next.location.href
    entry.pathname = next.location.pathname
    entry.routeIds = next.routeIds
    entry.matches = next.matches
    entry.location = next.location
    entry.presentation = options.presentation ?? entry.presentation
  }

  private begin(
    kind: TransitionKind,
    to: StackEntry,
    from: StackEntry | undefined,
    leaving: StackEntry[],
    group: string,
  ): StackTransition {
    // A transition still animating is settled before the next one starts.
    if (this.transition) this.settle(this.transition.id)
    for (const e of leaving) e.phase = 'leaving'
    if (from && !leaving.includes(from)) from.phase = 'covered'
    to.phase = kind === 'push' || kind === 'replace' ? 'entering' : 'active'
    this.activeId = to.id
    const animate =
      this.gesturePopped === undefined || !leaving.some((e) => e.id === this.gesturePopped)
    this.gesturePopped = undefined
    this.transition = {
      id: ++nextTransitionId,
      kind,
      to: to.id,
      from: from?.id,
      leaving: leaving.map((e) => e.id),
      groupChanged: !!from && from.group !== group,
      animate,
    }
    return this.transition
  }

  /** The view finished animating a transition: entering pages are active, leaving pages are gone. */
  settle(transitionId: number) {
    const t = this.transition
    if (!t || t.id !== transitionId) return
    this.transition = undefined
    const to = this.byId(t.to)
    if (to && to.phase === 'entering') to.phase = 'active'
    for (const id of t.leaving) this.finishLeaving(id, false)
    this.notify()
  }

  /** Remove a page whose leave animation ended. */
  finishLeaving(id: string, notify = true) {
    const before = this.entries.length
    this.entries = this.entries.filter((e) => !(e.id === id && e.phase === 'leaving'))
    if (notify && this.entries.length !== before) this.notify()
  }

  /** Drop every page (the outlet unmounted). */
  reset() {
    this.entries = []
    this.activeId = undefined
    this.transition = undefined
    this.notify()
  }
}
