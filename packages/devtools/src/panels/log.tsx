import type { DevtoolsEntry, DevtoolsLevel, DevtoolsPanel, KitrApp } from '@kitr/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHub } from '../hooks'
import { icons, levelIcon, panelIcons, toneOf } from '../icon'
import { Button, Chip, Chips, Empty, LogList, Toolbar } from '../ui'

// kitr-allow-module-state: constant list, never mutated
const levels: DevtoolsLevel[] = ['debug', 'info', 'warn', 'error']
const storageKey = 'kitr:devtools:log'
const pageSize = 300

interface LogPrefs {
  levels: DevtoolsLevel[]
  channels: string[]
  follow: boolean
  relative: boolean
}

function loadPrefs(): LogPrefs {
  const fallback: LogPrefs = { levels: [...levels], channels: [], follow: true, relative: false }
  try {
    const raw = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null')
    if (!raw || typeof raw !== 'object') return fallback
    return {
      levels: Array.isArray(raw.levels)
        ? raw.levels.filter((l: unknown) => levels.includes(l as DevtoolsLevel))
        : fallback.levels,
      channels: Array.isArray(raw.channels) ? raw.channels.map(String) : [],
      follow: raw.follow !== false,
      relative: raw.relative === true,
    }
  } catch {
    return fallback
  }
}

/** The shared event log: level and channel filters, search, follow, relative time and row actions. */
export function logPanel(): DevtoolsPanel {
  return {
    id: 'log',
    label: 'Log',
    group: 'app',
    icon: panelIcons.log,
    badge: (app) => {
      const errors = app.container.use('devtools').counts().error
      return errors ? { value: errors, tone: 'error' } : null
    },
    render: (app) => <LogPanel app={app} />,
    actions: [
      {
        id: 'clear',
        label: 'Clear',
        icon: icons.clear,
        run: (app) => app.container.use('devtools').clear(),
      },
    ],
  }
}

/** The nearest ancestor that scrolls, falling back to the page. */
function scrollParent(node: HTMLElement | null): HTMLElement | null {
  for (let el = node?.parentElement; el; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowY
    if (overflow === 'auto' || overflow === 'scroll') return el
  }
  return (document.scrollingElement as HTMLElement | null) ?? null
}

function LogPanel({ app }: { app: KitrApp }) {
  const hub = useHub(app)
  const [prefs, setPrefs] = useState(loadPrefs)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(pageSize)
  const [menu, setMenu] = useState<{ index: number; top: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const update = useCallback((patch: Partial<LogPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch }
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // Storage can be blocked; the filters then last for this session only.
      }
      return next
    })
  }, [])

  const counts = hub.counts()
  const channels = hub.channels()
  const needle = query.trim().toLowerCase()
  // biome-ignore lint/correctness/useExhaustiveDependencies: hub.version is the change signal for the hub's mutable lists
  const filtered = useMemo(
    () =>
      hub
        .entries()
        .filter(
          (e) =>
            (e.kind === 'mark' || prefs.levels.includes(e.level)) &&
            (!prefs.channels.length || prefs.channels.includes(e.channel)) &&
            (!needle ||
              `${e.channel} ${e.label} ${safeJson(e.data)}`.toLowerCase().includes(needle)),
        ),
    [hub, hub.version, prefs.levels, prefs.channels, needle],
  )
  const visible = filtered.slice(-shown)
  const older = filtered.length - visible.length

  // Follow: keep the newest entry in view, and let go when the reader scrolls up.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when new entries arrive
  useEffect(() => {
    const el = scrollParent(root.current)
    if (el && prefs.follow) el.scrollTop = el.scrollHeight
  }, [prefs.follow, visible.length, hub.version])
  useEffect(() => {
    const el = scrollParent(root.current)
    if (!el) return
    const onScroll = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight > 40)
        setPrefs((p) => (p.follow ? { ...p, follow: false } : p))
    }
    const target = el === document.scrollingElement ? window : el
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => target.removeEventListener('scroll', onScroll)
  }, [])

  const toggleChannel = (channel: string) =>
    update({
      channels: prefs.channels.includes(channel)
        ? prefs.channels.filter((c) => c !== channel)
        : [...prefs.channels, channel],
    })
  const toggleLevel = (level: DevtoolsLevel) =>
    update({
      levels: prefs.levels.includes(level)
        ? prefs.levels.filter((l) => l !== level)
        : [...prefs.levels, level],
    })

  // LogList owns the rows, so row actions find the entry from the row's position in the list.
  const openMenu = (target: EventTarget | null) => {
    const row = (target as HTMLElement | null)?.closest('.kitr-dt-log > *') as HTMLElement | null
    const list = row?.parentElement
    if (!row || !list || row.classList.contains('kitr-dt-mark')) return false
    setMenu({ index: Array.prototype.indexOf.call(list.children, row), top: row.offsetTop })
    return true
  }
  const entry: DevtoolsEntry | undefined = menu ? visible[menu.index] : undefined
  const closeMenu = () => setMenu(null)

  return (
    <div ref={root}>
      <div className="kitr-dt-sticky">
        <Chips>
          {levels.map((level) => (
            <Chip
              key={level}
              on={prefs.levels.includes(level)}
              tone={toneOf(level)}
              count={counts[level] || undefined}
              icon={levelIcon(level)}
              onClick={() => toggleLevel(level)}
            >
              {level}
            </Chip>
          ))}
          {channels.length ? <span className="kitr-dt-sep" /> : null}
          {channels.map((channel) => (
            <Chip
              key={channel}
              on={prefs.channels.includes(channel)}
              onClick={() => toggleChannel(channel)}
            >
              {channel}
            </Chip>
          ))}
        </Chips>
        <Toolbar>
          <input
            className="kitr-dt-input"
            type="search"
            placeholder="Search"
            aria-label="Search log"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Chip
            on={prefs.follow}
            icon={icons.follow}
            onClick={() => update({ follow: !prefs.follow })}
          >
            Follow
          </Chip>
          <Chip
            on={prefs.relative}
            icon={icons.play}
            onClick={() => update({ relative: !prefs.relative })}
          >
            Relative
          </Chip>
          <Button
            icon={icons.clear}
            aria-label="Clear"
            title="Clear"
            onClick={() => {
              if (prefs.channels.length) for (const c of prefs.channels) hub.clear(c)
              else hub.clear()
            }}
          />
        </Toolbar>
      </div>
      {!hub.entries().length ? (
        <Empty code="getDevtools(app)?.log('cart', 'added', item)">Nothing logged yet</Empty>
      ) : (
        // biome-ignore lint/a11y/noStaticElementInteractions: delegated long-press and context menu for rows owned by LogList
        <div
          style={{ position: 'relative' }}
          onContextMenu={(e) => {
            if (openMenu(e.target)) e.preventDefault()
          }}
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse') return
            const target = e.target
            clearTimeout(timer.current)
            timer.current = setTimeout(() => openMenu(target), 500)
          }}
          onPointerUp={() => clearTimeout(timer.current)}
          onPointerCancel={() => clearTimeout(timer.current)}
          onPointerLeave={() => clearTimeout(timer.current)}
        >
          {older > 0 ? (
            <button
              type="button"
              className="kitr-dt-btn"
              onClick={() => setShown((n) => n + pageSize)}
            >
              +{older} older
            </button>
          ) : null}
          <LogList
            entries={visible}
            relative={prefs.relative}
            onChannel={toggleChannel}
            empty="No matches"
          />
          {menu && entry ? (
            <div className="kitr-dt-menu" style={{ top: menu.top, right: 8 }}>
              <button
                type="button"
                className="kitr-dt-menu-item"
                onClick={() => {
                  void copy(JSON.stringify(entry, null, 2))
                  closeMenu()
                }}
              >
                Copy
              </button>
              <button
                type="button"
                className="kitr-dt-menu-item"
                onClick={() => {
                  update({ channels: [entry.channel] })
                  closeMenu()
                }}
              >
                Only this channel
              </button>
              <button
                type="button"
                className="kitr-dt-menu-item"
                onClick={() => {
                  update({ channels: channels.filter((c) => c !== entry.channel) })
                  closeMenu()
                }}
              >
                Hide this channel
              </button>
              <button type="button" className="kitr-dt-menu-item" onClick={closeMenu}>
                Close
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return String(value)
  }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Clipboard access can be denied; copying is best effort.
  }
}
