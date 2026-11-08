import type { DevtoolsAction, DevtoolsPanel, KitrApp } from '@kitr/core'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Icon, icons, panelIcons } from './icon'
import type { DevtoolsConfig } from './index'
import { useHub } from './panels'
import { Button, styles } from './ui'

const STORAGE_KEY = 'kitr:devtools'

interface Persisted {
  open?: boolean
  tab?: string
  height?: number
}

function readPersisted(): Persisted {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}
function persist(patch: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readPersisted(), ...patch }))
  } catch {}
}

/** The floating trigger, the bottom panel with one tab per contributed panel, and the command palette. */
export function DevtoolsOverlay({ app }: { app: KitrApp }) {
  const config = app.config.get('devtools', {} as DevtoolsConfig)
  const hub = useHub(app)
  const [open, setOpen] = useState(() => readPersisted().open ?? config.openByDefault ?? false)
  const [tab, setTab] = useState(() => readPersisted().tab ?? 'app')
  const [height, setHeight] = useState(
    () => readPersisted().height ?? Math.round(window.innerHeight * 0.45),
  )
  const [palette, setPalette] = useState(false)
  const panels = hub.panels
  const current = panels.find((p) => p.id === tab) ?? panels[0]

  useEffect(() => persist({ open, tab, height }), [open, tab, height])

  // ctrl/cmd+shift+K toggles; ctrl/cmd+shift+P opens the command palette.
  useEffect(() => {
    const key = (config.shortcutKey ?? 'k').toLowerCase()
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return
      const k = e.key.toLowerCase()
      if (k === key) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (k === 'p') {
        e.preventDefault()
        setPalette((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [config.shortcutKey])

  const errorCount = hub.entries().filter((e) => e.level === 'error').length
  const position = config.position ?? 'bottom-left'
  const triggerStyle = {
    [position.startsWith('bottom') ? 'bottom' : 'top']: 12,
    [position.endsWith('left') ? 'left' : 'right']: 12,
  }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = height
    const move = (ev: MouseEvent) =>
      setHeight(Math.max(120, Math.min(window.innerHeight - 40, startH + (startY - ev.clientY))))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <div className="kitr-dt" data-kitr-devtools="">
      <style>{styles}</style>
      {!open ? (
        <button
          type="button"
          className="kitr-dt-trigger"
          style={triggerStyle}
          onClick={() => setOpen(true)}
          title="kitr devtools (ctrl/cmd+shift+K)"
        >
          k{errorCount ? <span className="kitr-dt-trigger-badge">{errorCount}</span> : null}
        </button>
      ) : (
        <div className="kitr-dt-panel" style={{ height }}>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: drag handle; the panel height is also persisted */}
          <div className="kitr-dt-resize" onMouseDown={startResize} />
          <div className="kitr-dt-tabs">
            <span style={{ color: '#a5b4fc', fontWeight: 700, padding: '0 8px' }}>kitr</span>
            {panels.map((p) => (
              <Tab
                key={p.id}
                panel={p}
                app={app}
                active={p.id === current?.id}
                onClick={() => setTab(p.id)}
              />
            ))}
            <span className="kitr-dt-spacer" />
            <Button onClick={() => setPalette(true)} title="Command palette (ctrl/cmd+shift+P)">
              <Icon icon={icons.command} /> actions
            </Button>
            <Button onClick={() => setOpen(false)} title="Close (ctrl/cmd+shift+K)">
              <Icon icon={icons.close} />
            </Button>
          </div>
          <div className="kitr-dt-body">
            {current ? (
              <>
                {current.actions?.length ? (
                  <div className="kitr-dt-toolbar">
                    {current.actions.map((a) => (
                      <Button key={a.id} onClick={() => void run(a, app)}>
                        {a.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <PanelErrorBoundary key={current.id}>
                  <PanelBody panel={current} app={app} />
                </PanelErrorBoundary>
              </>
            ) : null}
          </div>
        </div>
      )}
      {palette ? (
        <Palette
          app={app}
          panels={panels}
          onClose={() => setPalette(false)}
          onSelectPanel={(id) => {
            setTab(id)
            setOpen(true)
          }}
        />
      ) : null}
    </div>
  )
}

function Tab({
  panel,
  app,
  active,
  onClick,
}: {
  panel: DevtoolsPanel
  app: KitrApp
  active: boolean
  onClick: () => void
}) {
  let badge: ReactNode = null
  try {
    const b = panel.badge?.(app)
    if (b !== null && b !== undefined && b !== 0 && b !== '')
      badge = <span className="kitr-dt-badge">{b}</span>
  } catch {}
  return (
    <button
      type="button"
      className={`kitr-dt-tab${active ? ' kitr-dt-tab-active' : ''}`}
      onClick={onClick}
    >
      {panelIcons[panel.id] ? <Icon icon={panelIcons[panel.id]!} /> : null}
      <span className="kitr-dt-tab-label">{panel.label}</span>
      {badge}
    </button>
  )
}

async function run(action: DevtoolsAction, app: KitrApp) {
  try {
    await action.run(app)
    app.container.use('devtools').log('devtools', `ran ${action.label}`, undefined, 'debug')
  } catch (e) {
    app.container.use('devtools').log('devtools', `${action.label} failed`, e, 'error')
  }
}

function Palette({
  app,
  panels,
  onClose,
  onSelectPanel,
}: {
  app: KitrApp
  panels: DevtoolsPanel[]
  onClose: () => void
  onSelectPanel: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const items = useMemo(() => {
    const out: Array<{ key: string; label: string; hint: string; run: () => void }> = []
    for (const p of panels) {
      out.push({
        key: `panel:${p.id}`,
        label: `Open ${p.label}`,
        hint: 'panel',
        run: () => onSelectPanel(p.id),
      })
      for (const a of p.actions ?? [])
        out.push({
          key: `${p.id}:${a.id}`,
          label: a.label,
          hint: p.label,
          run: () => void run(a, app),
        })
    }
    const q = query.toLowerCase()
    return q
      ? out.filter((i) => i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q))
      : out
  }, [panels, query, app, onSelectPanel])
  const active = items[Math.min(index, items.length - 1)]
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop closes the palette; Escape works too
    // biome-ignore lint/a11y/useKeyWithClickEvents: same
    <div className="kitr-dt-palette" onClick={onClose}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stops the backdrop click */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: same */}
      <div className="kitr-dt-palette-box" onClick={(e) => e.stopPropagation()}>
        <input
          // biome-ignore lint/a11y/noAutofocus: a command palette is opened by a shortcut and expects typing
          autoFocus
          placeholder="Type an action…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'ArrowDown') setIndex((i) => Math.min(i + 1, items.length - 1))
            if (e.key === 'ArrowUp') setIndex((i) => Math.max(i - 1, 0))
            if (e.key === 'Enter' && active) {
              active.run()
              onClose()
            }
          }}
        />
        <div style={{ maxHeight: 320, overflow: 'auto' }}>
          {items.map((item) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: keyboard handled on the input above
            // biome-ignore lint/a11y/useKeyWithClickEvents: same
            <div
              key={item.key}
              className={`kitr-dt-palette-item${item === active ? ' kitr-dt-palette-item-active' : ''}`}
              onClick={() => {
                item.run()
                onClose()
              }}
            >
              <span>{item.label}</span>
              <span className="kitr-dt-muted">{item.hint}</span>
            </div>
          ))}
          {!items.length ? (
            <div className="kitr-dt-palette-item kitr-dt-muted">No matches</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

import { Component } from 'react'

/** Calls `render()` inside the boundary, so a panel that throws can't take the app down with it. */
function PanelBody({ panel, app }: { panel: DevtoolsPanel; app: KitrApp }) {
  return <>{panel.render(app) as ReactNode}</>
}

class PanelErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown }
  static getDerivedStateFromError(error: unknown) {
    return { error }
  }
  render() {
    if (this.state.error)
      return (
        <p className="kitr-dt-error">
          Panel crashed: {String((this.state.error as Error)?.message ?? this.state.error)}
        </p>
      )
    return this.props.children
  }
}
