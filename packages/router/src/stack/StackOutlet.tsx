import type { KitrApp } from '@kitr/core'
import {
  type AnyRouteMatch,
  type AnyRouter,
  Match,
  Outlet,
  type ParsedLocation,
  RouterContextProvider,
  useMatch,
  useRouter,
} from '@tanstack/react-router'
import * as React from 'react'
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { type BackRegistry, BackRegistryContext, createBackRegistry } from './back'
import {
  type Presentation,
  type StackEngine,
  StackEngine as StackEngineClass,
  type StackEngineOptions,
  type StackEntry,
} from './engine'
import { createEntryRouter, type EntryRouter } from './entry-router'
import { attachDrag, type GestureRule } from './gestures'
import { animate, clearMotion, detectMotionStyle, type MotionStyle, motionFor } from './motion'

/**
 * `<StackOutlet>`: an `<Outlet>` whose pages stack. A navigation deeper pushes the new page over
 * the current one, which stays mounted (its state, scroll position and media untouched); back
 * slides it away and the page beneath is there as it was. Routes declare how they arrive
 * (`staticData.presentation`: push, cover, sheet, fullscreen); iOS gets edge swipe back, Android
 * the hardware back button, and a cold start on a deep page gets its `stackParent` beneath it.
 *
 * On the server and during hydration it renders a plain `<Outlet>`, so SSR output and the first
 * client paint are the ordinary route tree; the stack takes over after hydration.
 */
export interface StackOutletProps extends StackEngineOptions {
  /** `ios`, `android`, `plain` (web, desktop) or `none`. Default: detected from the device, `none` with reduced motion. */
  motion?: MotionStyle | 'auto'
  /** Edge swipe back and drag to dismiss. Default: on for touch input. */
  gestures?: boolean | GestureRule
  /** Back pressed at the root of the stack (Android back with nothing to pop). Return true when handled. Default: exit the app on Android, else nothing. */
  onRootBack?: () => boolean | undefined
  /** An engine shared with `<StackTabs>`; one is created otherwise. */
  engine?: StackEngine
  className?: string
  style?: CSSProperties
}

/** What `useStack()` returns inside a stacked page. */
export interface StackInfo {
  /** The active page's entry, or undefined outside a stack. */
  entry: StackEntry | undefined
  /** How many pages the current tab holds. */
  depth: number
  /** Whether `pop()` has a page to go back to. */
  canPop: boolean
  /** Go back one page (the router's history back). */
  pop(): void
  /** Dismiss the top page the way its presentation suggests: the same as `pop()` for now. */
  dismiss(): void
  presentation: Presentation | undefined
  /** Register a handler for the back button, newest first. */
  registry: BackRegistry
}

const StackContext = createContext<StackInfo | undefined>(undefined)
const EntryContext = createContext<StackEntry | undefined>(undefined)

/** The stack around the current page: depth, whether it can pop, and `pop()`. */
export function useStack(): StackInfo {
  const info = useContext(StackContext)
  const registry = useContext(BackRegistryContext)
  const router = useRouter()
  return (
    info ?? {
      entry: undefined,
      depth: 0,
      canPop: false,
      pop: () => router.history.back(),
      dismiss: () => router.history.back(),
      presentation: undefined,
      registry,
    }
  )
}

/** The entry of the page this component renders in, or undefined outside a stack page. */
export function useStackEntry(): StackEntry | undefined {
  return useContext(EntryContext)
}

const noopSubscribe = () => () => {}
const useHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )

type RouterState = {
  status: 'idle' | 'pending'
  matches: AnyRouteMatch[]
  location: ParsedLocation
}

// React 19.2 ships `<Activity>`; React 18 falls back to hiding the subtree with `display: none`.
const Activity: React.ComponentType<{ mode: 'visible' | 'hidden'; children: ReactNode }> =
  (React as unknown as { Activity?: React.ComponentType<any> }).Activity ??
  function HiddenFallback({ mode, children }) {
    return <div style={mode === 'hidden' ? { display: 'none' } : undefined}>{children}</div>
  }

/** The stacked outlet. A plain `<Outlet>` on the server and until hydration, then pages that push, pop and stay mounted beneath. */
export function StackOutlet(props: StackOutletProps) {
  const hydrated = useHydrated()
  const router = useRouter()
  if (!hydrated || router.isServer) return <Outlet />
  return <ClientStack {...props} />
}

function ClientStack(props: StackOutletProps) {
  const router = useRouter() as AnyRouter
  const outletMatch = useMatch({ strict: false }) as unknown as { routeId: string }
  const outletRouteId = outletMatch.routeId
  const [ownEngine] = useState(() =>
    props.engine
      ? undefined
      : new StackEngineClass({ keepAlive: props.keepAlive, groupOf: props.groupOf }),
  )
  const engine = props.engine ?? ownEngine!
  const [, rerender] = useReducer((x: number) => x + 1, 0)
  const routers = useRef(new Map<string, EntryRouter>()).current
  const elements = useRef(new Map<string, HTMLDivElement>()).current
  const scrim = useRef<HTMLDivElement>(null)
  const [registry] = useState(() => createBackRegistry())
  const [motionStyle] = useState<MotionStyle>(() =>
    props.motion && props.motion !== 'auto' ? props.motion : detectMotionStyle(),
  )
  // `createKitrRouter` puts the app in context; a plain TanStack router has no platform service.
  const app = (router.options.context as { app?: KitrApp } | undefined)?.app

  const ancestorIds = useMemo(() => {
    const matches = router.stores.matches.get() as AnyRouteMatch[]
    const i = matches.findIndex((m) => m.routeId === outletRouteId)
    return matches.slice(0, i + 1).map((m) => m.routeId)
  }, [router, outletRouteId])

  const entryRouterOf = (entry: StackEntry): EntryRouter => {
    let er = routers.get(entry.id)
    if (!er) {
      er = createEntryRouter(router, ancestorIds, {
        matches: entry.matches,
        location: entry.location,
      })
      routers.set(entry.id, er)
    }
    return er
  }

  const applyState = useCallback(
    (state: RouterState) => {
      if (state.status !== 'idle') return
      engine.apply({ matches: state.matches, location: state.location, outletRouteId })
      const active = engine.active
      if (active) {
        const er = routers.get(active.id)
        if (er) er.update(state.matches, state.location, 'idle')
      }
      for (const [id] of routers) if (!engine.byId(id)) routers.delete(id)
    },
    [engine, outletRouteId, routers],
  )

  // The first client render: seed the stack from the router's current state, synchronously, so
  // the page that hydrated is the stack's first entry in this very render.
  if (!engine.active) applyState(router.stores.__store.get() as RouterState)

  useLayoutEffect(() => {
    const store = router.stores.__store as unknown as {
      subscribe(listener: () => void): { unsubscribe(): void }
    }
    const { unsubscribe } = store.subscribe(() => {
      applyState(router.stores.__store.get() as RouterState)
    })
    const unsubEngine = engine.subscribe(rerender)
    return () => {
      unsubscribe()
      unsubEngine()
    }
  }, [router, engine, applyState])

  useEffect(() => () => engine.reset(), [engine])

  // Cold start on a deep page: put its `stackParent` beneath it so back has somewhere to go. The
  // parent replaces the current history entry and the page is pushed back on top, unanimated.
  const silent = useRef(false)
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    const active = engine.active
    if (!active || engine.depth > 1) return
    const parent = stackParentOf(active)
    if (!parent || parent === active.pathname) return
    const index = (active.location.state as { __TSR_index?: number }).__TSR_index ?? 0
    if (index > 0) return // The app has history already; the browser's back works.
    const href = active.href
    silent.current = true
    void (async () => {
      try {
        await router.navigate({ href: parent, replace: true })
        await router.navigate({ href })
      } finally {
        silent.current = false
      }
    })()
  }, [engine, router])

  // Transitions: animate the page coming to the front and the pages leaving, then settle.
  const transition = engine.transition
  useLayoutEffect(() => {
    if (!transition) return
    let cancelled = false
    const run = async () => {
      const to = engine.byId(transition.to)
      const toEl = elements.get(transition.to)
      const fromEl = transition.from ? elements.get(transition.from) : undefined
      const leavingEls = transition.leaving.map((id) => [id, elements.get(id)] as const)
      const style: MotionStyle = transition.animate && !silent.current ? motionStyle : 'none'
      const presentationOf = (id: string) => engine.byId(id)?.presentation ?? 'push'
      const jobs: Promise<void>[] = []
      if (transition.kind === 'push' || transition.kind === 'replace') {
        const step = motionFor(to?.presentation ?? 'push', style)
        jobs.push(animate(toEl, step.enter, step))
        if (step.under && fromEl && transition.kind === 'push')
          jobs.push(animate(fromEl, step.under, step))
        if (step.scrim && scrim.current)
          jobs.push(animate(scrim.current, [{ opacity: 0 }, { opacity: 1 }], step))
        for (const [, el] of leavingEls)
          if (transition.kind === 'replace' && el)
            jobs.push(
              animate(el, [{ opacity: 1 }, { opacity: 0 }], {
                ...step,
                duration: step.duration / 2,
              }),
            )
      } else if (transition.kind === 'pop') {
        for (const [id, el] of leavingEls) {
          const step = motionFor(presentationOf(id), style)
          jobs.push(animate(el, step.exit ?? step.enter, { ...step, reverse: !step.exit }))
          if (step.under && toEl) jobs.push(animate(toEl, step.under, { ...step, reverse: true }))
          if (step.scrim && scrim.current)
            jobs.push(animate(scrim.current, [{ opacity: 1 }, { opacity: 0 }], step))
        }
      } else {
        // A tab switch: cross-fade.
        const step = motionFor('push', style === 'none' ? 'none' : 'plain')
        jobs.push(animate(toEl, [{ opacity: 0 }, { opacity: 1 }], step))
        if (fromEl) jobs.push(animate(fromEl, [{ opacity: 1 }, { opacity: 0 }], step))
      }
      await Promise.all(jobs)
      if (cancelled) return
      for (const el of [toEl, fromEl, scrim.current, ...leavingEls.map(([, el]) => el)])
        clearMotion(el)
      engine.settle(transition.id)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [transition, engine, elements, motionStyle])

  // The back button: handlers first (a dialog), then the stack, then the host (tabs, exit).
  useEffect(() => {
    const platform = app?.container.has('platform')
      ? (app.container.use('platform') as {
          onBackButton(l: (info: { canGoBack: boolean }) => void): () => void
          exit(): Promise<void>
          os: string
        })
      : undefined
    if (!platform) return
    return platform.onBackButton((info) => {
      if (registry.run()) return
      if (engine.depth > 1) return void router.history.back()
      if (props.onRootBack?.() === true) return
      if (info.canGoBack) return void router.history.back()
      if (platform.os === 'android') void platform.exit()
    })
  }, [app, engine, registry, router, props.onRootBack])

  const active = engine.active
  const visible = visibleIds(engine)
  const mounted = engine.entries.filter((e) => engine.isMounted(e))
  const gestureRule: GestureRule | undefined =
    props.gestures === false
      ? undefined
      : typeof props.gestures === 'object'
        ? props.gestures
        : props.gestures === true || motionStyle === 'ios' || motionStyle === 'android'
          ? {}
          : undefined

  const info: StackInfo = {
    entry: active,
    depth: engine.depth,
    canPop: engine.depth > 1,
    pop: () => router.history.back(),
    dismiss: () => router.history.back(),
    presentation: active?.presentation,
    registry,
  }

  const sheetOpen =
    active?.presentation === 'sheet' ||
    (!!transition && engine.byId(transition.to)?.presentation === 'sheet')
  const coverOpen = active?.presentation === 'cover'

  return (
    <BackRegistryContext.Provider value={registry}>
      <StackContext.Provider value={info}>
        <div
          data-kitr-stack=""
          className={props.className}
          style={{ position: 'relative', height: '100%', overflow: 'hidden', ...props.style }}
        >
          {mounted.map((entry) => (
            <Activity key={entry.id} mode={visible.has(entry.id) ? 'visible' : 'hidden'}>
              <StackPage
                entry={entry}
                engine={engine}
                router={router}
                entryRouter={entryRouterOf(entry)}
                register={(el) => {
                  if (el) elements.set(entry.id, el)
                  else elements.delete(entry.id)
                }}
                gestureRule={gestureRule}
                motionStyle={motionStyle}
                scrim={scrim}
                beneath={entry.id !== active?.id}
              />
            </Activity>
          ))}
          <div
            ref={scrim}
            data-kitr-stack-scrim=""
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--kitr-stack-scrim, rgba(0, 0, 0, 0.4))',
              opacity: sheetOpen || coverOpen ? 1 : 0,
              pointerEvents: sheetOpen ? 'auto' : 'none',
              zIndex: sheetOpen || coverOpen ? (orderOf(engine, active) ?? 0) - 0.5 : -1,
              transition: 'none',
            }}
            onClick={sheetOpen ? () => router.history.back() : undefined}
          />
        </div>
      </StackContext.Provider>
    </BackRegistryContext.Provider>
  )
}

function stackParentOf(entry: StackEntry): string | undefined {
  for (let i = entry.matches.length - 1; i >= 0; i--) {
    const data = entry.matches[i]!.staticData as { stackParent?: string } | undefined
    if (data?.stackParent) return data.stackParent
  }
  return undefined
}

/** The pages that must be visible: the active one, anything animating, and what a sheet shows beneath it. */
function visibleIds(engine: StackEngine): Set<string> {
  const out = new Set<string>()
  const active = engine.active
  if (!active) return out
  out.add(active.id)
  const t = engine.transition
  if (t) {
    out.add(t.to)
    if (t.from) out.add(t.from)
    for (const id of t.leaving) out.add(id)
  }
  // Sheets show the page beneath them; a chain of sheets shows the first non-sheet page.
  const stack = engine.stackOf(active.group)
  for (let i = stack.length - 1; i > 0; i--) {
    if (stack[i]!.presentation !== 'sheet') break
    out.add(stack[i - 1]!.id)
  }
  return out
}

function orderOf(engine: StackEngine, entry: StackEntry | undefined): number | undefined {
  if (!entry) return undefined
  return engine.stackOf(entry.group).indexOf(entry) + 1
}

interface StackPageProps {
  entry: StackEntry
  engine: StackEngine
  router: AnyRouter
  entryRouter: EntryRouter
  register: (el: HTMLDivElement | null) => void
  gestureRule: GestureRule | undefined
  motionStyle: MotionStyle
  scrim: React.RefObject<HTMLDivElement | null>
  beneath: boolean
}

function StackPage({
  entry,
  engine,
  router,
  entryRouter,
  register,
  gestureRule,
  motionStyle,
  scrim,
  beneath,
}: StackPageProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el
      register(el)
    },
    [register],
  )

  // Gestures: edge swipe pops a pushed page; a downward drag dismisses a cover or a sheet.
  useEffect(() => {
    const el = ref.current
    if (!el || !gestureRule || beneath) return
    if (entry.presentation === 'fullscreen') return
    const axis = entry.presentation === 'push' ? 'x' : 'y'
    const step = motionFor(entry.presentation, motionStyle === 'none' ? 'plain' : motionStyle)
    const under = () => {
      const stack = engine.stackOf(entry.group)
      const i = stack.indexOf(entry)
      return i > 0
        ? (document.querySelector(
            `[data-kitr-stack-page="${stack[i - 1]!.id}"]`,
          ) as HTMLElement | null)
        : null
    }
    let underEl: HTMLElement | null = null
    return attachDrag(el, {
      ...gestureRule,
      axis,
      fromEdge: axis === 'x',
      enabled: () => engine.depth > 1 && !engine.transition,
      onStart: () => {
        underEl = under()
        el.style.transition = 'none'
        if (underEl) underEl.style.transition = 'none'
      },
      onProgress: (p) => {
        el.style.transform =
          axis === 'x' ? `translate3d(${p * 100}%, 0, 0)` : `translate3d(0, ${p * 100}%, 0)`
        if (underEl && step.under && axis === 'x')
          underEl.style.transform = `translate3d(${-30 * (1 - p)}%, 0, 0)`
        if (scrim.current && step.scrim) scrim.current.style.opacity = String(1 - p)
      },
      onEnd: (commit, p) => {
        const rest = { ...step, from: p }
        const exit = step.exit ?? [...step.enter].reverse()
        if (commit) {
          void Promise.all([
            animate(el, exit, { ...rest }),
            underEl && step.under
              ? animate(underEl, step.under, { ...rest, reverse: true })
              : undefined,
            scrim.current && step.scrim
              ? animate(scrim.current, [{ opacity: 1 }, { opacity: 0 }], rest)
              : undefined,
          ]).then(() => {
            engine.gesturePopped = entry.id
            router.history.back()
          })
        } else {
          void Promise.all([
            animate(el, [...exit].reverse(), { ...rest, from: 1 - p }),
            underEl && step.under
              ? animate(underEl, step.under, { ...rest, from: 1 - p })
              : undefined,
            scrim.current && step.scrim
              ? animate(scrim.current, [{ opacity: 0 }, { opacity: 1 }], { ...rest, from: 1 - p })
              : undefined,
          ]).then(() => {
            clearMotion(el)
            clearMotion(underEl)
            if (scrim.current && step.scrim) scrim.current.style.opacity = '1'
          })
        }
      },
    })
  }, [entry, engine, router, gestureRule, motionStyle, beneath, scrim])

  const order = orderOf(engine, entry) ?? 0
  const base: CSSProperties = {
    position: 'absolute',
    inset: 0,
    overflow: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    background: 'var(--kitr-stack-page-bg, Canvas)',
    zIndex: order,
    willChange: 'transform',
    touchAction: entry.presentation === 'push' ? 'pan-y' : 'pan-x',
  }
  const sheet: CSSProperties =
    entry.presentation === 'sheet'
      ? {
          top: 'auto',
          maxHeight: 'var(--kitr-sheet-max-height, 90%)',
          borderRadius: 'var(--kitr-sheet-radius, 16px 16px 0 0)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
        }
      : {}

  return (
    <div
      ref={setRef}
      data-kitr-stack-page={entry.id}
      data-presentation={entry.presentation}
      data-phase={entry.phase}
      data-active={beneath ? undefined : ''}
      role={entry.presentation === 'sheet' || entry.presentation === 'cover' ? 'dialog' : undefined}
      // Covered pages are inert so focus and clicks never land on them.
      inert={beneath && entry.presentation !== 'sheet' ? true : undefined}
      style={{ ...base, ...sheet }}
    >
      <EntryContext.Provider value={entry}>
        <RouterContextProvider router={entryRouter.router}>
          <Match routeId={entry.routeIds[0]!} />
        </RouterContextProvider>
      </EntryContext.Provider>
    </div>
  )
}
