import type { DevtoolsHub, DevtoolsPanel, KitrApp } from '@kitr/core'
import {
  Component,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useHub } from './hooks'
import { Icon, icons } from './icon'
import type { DevtoolsConfig } from './index'
import { readBadge, type TabBadge } from './shell/actions'
import { Dock } from './shell/dock'
import { Header, type Unread } from './shell/header'
import { matchShortcut } from './shell/keys'
import { LayersContext } from './shell/layers'
import { Palette, type PaletteItem } from './shell/palette'
import { persist, persistSession, readPersisted, readSession } from './shell/persist'
import { Sheet, type Snap } from './shell/sheet'
import { clampY, startPos, Trigger, type TriggerPos } from './shell/trigger'
import { readInsets, useIsPhone, useViewport } from './shell/use-layout'
import { useScheme } from './shell/use-theme'
import { Button, Empty, styles } from './ui'

const LONG_PRESS_MS = 600
const GESTURE_SLOP = 10
const DEFAULT_RIGHT_WIDTH = 420

/**
 * The channels whose warn and error entries count as unread for a panel: the log sees everything,
 * a few built-ins read the channel their package logs to, and a contributed panel reads its own id.
 */
function channelsOf(id: string): string[] | null {
  if (id === 'log') return null
  if (id === 'network') return ['http']
  return [id]
}

function unreadTotals(hub: DevtoolsHub, id: string): Unread {
  const totals = { warn: 0, error: 0 }
  const channels = channelsOf(id)
  for (const ch of channels ?? [undefined]) {
    for (const e of hub.entries(ch)) {
      if (e.level === 'error') totals.error++
      else if (e.level === 'warn') totals.warn++
    }
  }
  return totals
}

/** Calls `render()` inside the boundary below, so a panel that throws cannot take the app down. */
function PanelHost({ panel, app }: { panel: DevtoolsPanel; app: KitrApp }) {
  return <>{panel.render(app) as ReactNode}</>
}

class PanelBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown }
  static getDerivedStateFromError(error: unknown) {
    return { error }
  }
  render() {
    const { error } = this.state
    if (error === null) return this.props.children
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Empty>{String((error as Error)?.message ?? error)}</Empty>
        <Button onClick={() => this.setState({ error: null })}>Retry</Button>
      </div>
    )
  }
}

/**
 * The overlay root. It renders a host element and puts everything else into a shadow root, so app
 * CSS (a Tailwind preflight, global `button {}` rules) cannot leak in.
 */
export function DevtoolsOverlay({ app }: { app: KitrApp }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [root, setRoot] = useState<ShadowRoot | null>(null)
  useLayoutEffect(() => {
    const host = hostRef.current
    if (host) setRoot(host.shadowRoot ?? host.attachShadow({ mode: 'open' }))
  }, [])
  return (
    <div ref={hostRef} data-kitr-devtools="">
      {root ? createPortal(<Shell app={app} />, root as unknown as Element) : null}
    </div>
  )
}

function Shell({ app }: { app: KitrApp }) {
  const config = app.config.get('devtools', {} as DevtoolsConfig)
  const hub = useHub(app)
  const phone = useIsPhone()
  const viewport = useViewport()
  // Insets change with rotation and the keyboard, which show up as a phone or viewport change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the layout changes
  const insets = useMemo(() => readInsets(app), [app, phone, viewport.height])
  const flag = useState(() => {
    const name = config.urlFlag === undefined ? 'kitr-devtools' : config.urlFlag
    return name !== false && new URLSearchParams(window.location.search).has(name)
  })[0]
  const saved = useState(readPersisted)[0]

  const [open, setOpen] = useState(() => flag || (saved.open ?? config.openByDefault ?? false))
  const [tab, setTab] = useState(saved.tab ?? 'app')
  const [dock, setDock] = useState<'bottom' | 'right'>(saved.dock ?? config.dock ?? 'bottom')
  const [size, setSize] = useState({
    bottom: saved.size?.bottom ?? Math.round(window.innerHeight * 0.45),
    right: saved.size?.right ?? DEFAULT_RIGHT_WIDTH,
  })
  const [snap, setSnap] = useState<Snap>(saved.sheet ?? 'half')
  const [triggerPos, setTriggerPos] = useState<TriggerPos | null>(saved.trigger ?? null)
  const [override, setOverride] = useState(saved.theme)
  const [hidden, setHidden] = useState(() => !flag && !!readSession().hiddenUntil)
  const [palette, setPalette] = useState(false)
  const [recent, setRecent] = useState(saved.recent ?? [])
  const scheme = useScheme(config.theme)
  const theme = override ?? scheme

  const panels = hub.panels
  const current = panels.find((p) => p.id === tab) ?? panels[0]

  // Unread warn/error entries per panel, counted against what was on screen when it was last viewed.
  const seen = useRef<Record<string, Unread>>({})
  const seenErrors = useRef(0)
  const totals: Record<string, Unread> = {}
  for (const p of panels) totals[p.id] = unreadTotals(hub, p.id)
  const badges: Record<string, TabBadge | null> = {}
  for (const p of panels) {
    const own = readBadge(p, app)
    const unread = p.id === current?.id ? null : diff(totals[p.id], seen.current[p.id])
    badges[p.id] =
      own ??
      (unread && unread.error + unread.warn > 0
        ? { value: unread.error + unread.warn, tone: unread.error > 0 ? 'error' : 'warn' }
        : null)
  }
  const errorTotal = hub.counts().error
  const triggerCount = open ? 0 : Math.max(0, errorTotal - seenErrors.current)
  useEffect(() => {
    if (open && current) seen.current[current.id] = totals[current.id] as Unread
    seenErrors.current = open ? errorTotal : Math.min(seenErrors.current, errorTotal)
  })

  useEffect(() => persist({ open }), [open])
  useEffect(() => {
    if (flag) persistSession({ hiddenUntil: false })
  }, [flag])

  // Focus goes back to the trigger when the window closes.
  const triggerEl = useRef<HTMLButtonElement | null>(null)
  const wasOpen = useRef(open)
  useEffect(() => {
    if (wasOpen.current && !open) triggerEl.current?.focus()
    wasOpen.current = open
  }, [open])

  // Escape closes the topmost layer: menus, then the palette, then the window.
  const stack = useRef<Array<() => void>>([])
  const layers = useMemo(
    () => ({
      push(close: () => void) {
        stack.current.push(close)
        return () => {
          stack.current = stack.current.filter((c) => c !== close)
        }
      },
    }),
    [],
  )
  const openRef = useRef(open)
  openRef.current = open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (matchShortcut(e, config.shortcut)) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setPalette((p) => !p)
      } else if (e.key === 'Escape') {
        const top = stack.current[stack.current.length - 1]
        if (top) {
          e.preventDefault()
          top()
        } else if (openRef.current) setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [config.shortcut])

  // Three-finger long press toggles the window; any real movement or lifting a finger cancels it.
  useEffect(() => {
    if (config.touchGesture === false) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let origin: Array<{ x: number; y: number }> = []
    const cancel = () => {
      clearTimeout(timer)
      timer = undefined
    }
    const onStart = (e: TouchEvent) => {
      cancel()
      if (e.touches.length !== 3) return
      origin = [...e.touches].map((t) => ({ x: t.clientX, y: t.clientY }))
      timer = setTimeout(() => setOpen((o) => !o), LONG_PRESS_MS)
    }
    const onMove = (e: TouchEvent) => {
      if (!timer) return
      const moved = [...e.touches].some((t, i) => {
        const o = origin[i]
        return !o || Math.hypot(t.clientX - o.x, t.clientY - o.y) > GESTURE_SLOP
      })
      if (moved) cancel()
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', cancel)
    window.addEventListener('touchcancel', cancel)
    return () => {
      cancel()
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', cancel)
      window.removeEventListener('touchcancel', cancel)
    }
  }, [config.touchGesture])

  const selectTab = (id: string) => {
    setTab(id)
    persist({ tab: id })
  }
  const changeDock = (next: 'bottom' | 'right') => {
    setDock(next)
    persist({ dock: next })
  }
  const hideTrigger = () => {
    setHidden(true)
    persistSession({ hiddenUntil: true })
  }
  const setTheme = (next: 'light' | 'dark') => {
    setOverride(next)
    persist({ theme: next })
  }

  const commands = ((): PaletteItem[] => {
    const out: PaletteItem[] = [
      {
        key: 'cmd:theme',
        label: 'Toggle theme',
        hint: '',
        panel: 'Devtools',
        icon: <Icon icon={theme === 'dark' ? icons.sun : icons.moon} />,
        recent: true,
        run: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      },
    ]
    if (!phone)
      out.push({
        key: 'cmd:dock',
        label: dock === 'bottom' ? 'Dock right' : 'Dock bottom',
        hint: '',
        panel: 'Devtools',
        icon: <Icon icon={dock === 'bottom' ? icons.dockRight : icons.dockBottom} />,
        recent: true,
        run: () => changeDock(dock === 'bottom' ? 'right' : 'bottom'),
      })
    if (config.trigger !== 'hidden')
      out.push({
        key: 'cmd:hide',
        label: 'Hide trigger for this session',
        hint: '',
        panel: 'Devtools',
        icon: <Icon icon={icons.hide} />,
        recent: true,
        run: hideTrigger,
      })
    return out
  })()

  const header = (
    <Header
      app={app}
      panels={panels}
      current={current}
      phone={phone}
      dock={dock}
      badges={badges}
      onTab={selectTab}
      onPalette={() => setPalette(true)}
      onDock={() => changeDock(dock === 'bottom' ? 'right' : 'bottom')}
      onClose={() => setOpen(false)}
    />
  )
  const body = (
    <div
      className="kitr-dt-body"
      role="tabpanel"
      id="kitr-dt-tabpanel"
      aria-labelledby={current ? `kitr-dt-tab-${current.id}` : undefined}
    >
      {current ? (
        <PanelBoundary key={current.id}>
          <PanelHost key={current.id} panel={current} app={app} />
        </PanelBoundary>
      ) : null}
    </div>
  )

  const triggerSize = phone ? 44 : 36
  const pos = triggerPos
    ? { ...triggerPos, y: clampY(triggerPos.y, triggerSize, insets) }
    : startPos(config.position ?? 'bottom-left', triggerSize, insets)
  const showTrigger = !open && !hidden && config.trigger !== 'hidden'
  const dockSize = dock === 'bottom' ? size.bottom : size.right

  return (
    <LayersContext.Provider value={layers}>
      <style>{styles}</style>
      <div className="kitr-dt" data-theme={theme}>
        {showTrigger ? (
          <Trigger
            mode={config.trigger === 'hover' ? 'hover' : 'auto'}
            phone={phone}
            pos={pos}
            insets={insets}
            count={triggerCount}
            buttonRef={(el) => {
              triggerEl.current = el
            }}
            onOpen={() => setOpen(true)}
            onMove={(next) => {
              setTriggerPos(next)
              persist({ trigger: next })
            }}
            onHide={hideTrigger}
            onReset={() => {
              setTriggerPos(null)
              persist({ trigger: undefined })
            }}
          />
        ) : null}
        {open ? (
          phone ? (
            <Sheet
              snap={snap}
              viewport={viewport}
              safeTop={insets.top}
              onSnap={(next) => {
                setSnap(next)
                persist({ sheet: next })
              }}
              onClose={() => setOpen(false)}
              header={header}
            >
              {body}
            </Sheet>
          ) : (
            <Dock
              side={dock}
              size={dockSize}
              onResize={(value) => setSize((s) => ({ ...s, [dock]: value }))}
              onResizeEnd={(value) => persist({ size: { ...size, [dock]: value } })}
            >
              {header}
              {body}
            </Dock>
          )
        ) : null}
        {palette ? (
          <Palette
            app={app}
            panels={panels}
            commands={commands}
            recent={recent}
            phone={phone}
            viewport={viewport}
            onPanel={(id) => {
              selectTab(id)
              setOpen(true)
            }}
            onRan={(key) => {
              const next = [key, ...recent.filter((k) => k !== key)].slice(0, 5)
              setRecent(next)
              persist({ recent: next })
            }}
            onClose={() => setPalette(false)}
          />
        ) : null}
      </div>
    </LayersContext.Provider>
  )
}

function diff(total: Unread | undefined, seen: Unread | undefined): Unread {
  return {
    warn: Math.max(0, (total?.warn ?? 0) - (seen?.warn ?? 0)),
    error: Math.max(0, (total?.error ?? 0) - (seen?.error ?? 0)),
  }
}
