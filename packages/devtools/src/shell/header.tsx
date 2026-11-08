import type { DevtoolsPanel, KitrApp } from '@kitr/core'
import { useLayoutEffect, useRef, useState } from 'react'
import { icons, Mark } from '../icon'
import { Badge, Button } from '../ui'
import { runAction, type TabBadge, visibleActions } from './actions'
import { Menu, type MenuItem } from './menu'
import { isIconElement, panelIcon } from './panel-icon'

export interface Unread {
  warn: number
  error: number
}

/** Room kept for the "+N" button when tabs overflow. */
const MORE_WIDTH = 56
const GAP = 2
const GUESS = 96

/** Splits the panels into the tabs that fit and the ones that go into "+N"; the active one always stays. */
function split(
  panels: DevtoolsPanel[],
  activeId: string | undefined,
  avail: number,
  width: (id: string) => number,
) {
  const total = panels.reduce((sum, p) => sum + width(p.id) + GAP, -GAP)
  if (avail <= 0 || total <= avail) return { shown: panels, hidden: [] as DevtoolsPanel[] }
  const budget = avail - MORE_WIDTH
  const keep = new Set<string>()
  let used = 0
  if (activeId) {
    keep.add(activeId)
    used = width(activeId)
  }
  for (const p of panels) {
    if (keep.has(p.id)) continue
    if (used + GAP + width(p.id) > budget) break
    keep.add(p.id)
    used += GAP + width(p.id)
  }
  return {
    shown: panels.filter((p) => keep.has(p.id)),
    hidden: panels.filter((p) => !keep.has(p.id)),
  }
}

/** The tab strip and the always-visible controls. */
export function Header({
  app,
  panels,
  current,
  phone,
  dock,
  badges,
  onTab,
  onPalette,
  onDock,
  onClose,
}: {
  app: KitrApp
  panels: DevtoolsPanel[]
  current: DevtoolsPanel | undefined
  phone: boolean
  dock: 'bottom' | 'right'
  badges: Record<string, TabBadge | null>
  onTab: (id: string) => void
  onPalette: () => void
  onDock: () => void
  onClose: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const widths = useRef<Record<string, number>>({})
  const focusId = useRef<string | null>(null)
  const [avail, setAvail] = useState(0)
  const [, remeasure] = useState(0)
  const [more, setMore] = useState(false)
  const [actions, setActions] = useState(false)
  const moreRef = useRef<HTMLSpanElement>(null)
  const actionsRef = useRef<HTMLSpanElement>(null)

  // Desktop only: phones scroll the strip instead of collapsing it.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el || phone) return
    const update = () => setAvail(el.clientWidth)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [phone])

  // Remember each tab's width while it is rendered, so hidden ones can still be placed.
  useLayoutEffect(() => {
    let changed = false
    for (const el of stripRef.current?.querySelectorAll<HTMLElement>('[data-tab-id]') ?? []) {
      const id = el.dataset.tabId as string
      const w = el.offsetWidth
      if (w > 0 && widths.current[id] !== w) {
        widths.current[id] = w
        changed = true
      }
    }
    if (changed) remeasure((n) => n + 1)
  })

  // Keep the active tab in view on phones, and move focus when arrow keys changed the tab.
  useLayoutEffect(() => {
    const id = current?.id
    if (!id) return
    const el = [...(stripRef.current?.querySelectorAll<HTMLElement>('[data-tab-id]') ?? [])].find(
      (t) => t.dataset.tabId === id,
    )
    if (phone) el?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
    if (focusId.current === id) {
      el?.focus()
      focusId.current = null
    }
  }, [current?.id, phone])

  const { shown, hidden } = phone
    ? { shown: panels, hidden: [] as DevtoolsPanel[] }
    : split(panels, current?.id, avail, (id) => widths.current[id] ?? GUESS)

  const move = (to: number) => {
    const next = panels[(to + panels.length) % panels.length]
    if (!next) return
    focusId.current = next.id
    onTab(next.id)
  }
  const index = panels.findIndex((p) => p.id === current?.id)

  const items: MenuItem[] = current
    ? visibleActions(current, app).map((a) => ({
        key: a.id,
        label: a.label,
        icon: isIconElement(a.icon) ? a.icon : undefined,
        danger: a.danger,
        onSelect: () => void runAction(a, app),
      }))
    : []

  return (
    <div className="kitr-dt-header">
      <span style={{ display: 'inline-flex', color: 'var(--dt-accent)', padding: '0 4px' }}>
        <Mark size={phone ? 16 : 20} />
      </span>
      <div ref={wrapRef} style={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center' }}>
        <div
          ref={stripRef}
          className="kitr-dt-tabs"
          role="tablist"
          style={
            phone ? undefined : { maskImage: 'none', WebkitMaskImage: 'none', overflow: 'hidden' }
          }
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') move(index + 1)
            else if (e.key === 'ArrowLeft') move(index - 1)
            else if (e.key === 'Home') move(0)
            else if (e.key === 'End') move(panels.length - 1)
            else return
            e.preventDefault()
          }}
        >
          {shown.map((p) => {
            const active = p.id === current?.id
            const badge = badges[p.id]
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                id={`kitr-dt-tab-${p.id}`}
                data-tab-id={p.id}
                aria-selected={active}
                aria-controls="kitr-dt-tabpanel"
                tabIndex={active ? 0 : -1}
                className={`kitr-dt-tab${active ? ' kitr-dt-tab-active' : ''}`}
                onClick={() => onTab(p.id)}
              >
                {panelIcon(p)}
                <span className="kitr-dt-tab-label">{p.label}</span>
                {badge ? <Badge tone={badge.tone}>{badge.value}</Badge> : null}
              </button>
            )
          })}
        </div>
        {hidden.length ? (
          <span ref={moreRef} style={{ position: 'relative', flex: 'none' }}>
            <button
              type="button"
              className="kitr-dt-tab"
              aria-haspopup="menu"
              aria-expanded={more}
              onClick={() => setMore((m) => !m)}
            >
              +{hidden.length}
            </button>
            {more ? (
              <Menu
                ignore={moreRef}
                onClose={() => setMore(false)}
                items={hidden.map((p) => ({
                  key: p.id,
                  label: p.label,
                  icon: isIconElement(p.icon) ? p.icon : undefined,
                  onSelect: () => onTab(p.id),
                }))}
              />
            ) : null}
          </span>
        ) : null}
      </div>
      {items.length ? (
        <span ref={actionsRef} style={{ position: 'relative', flex: 'none' }}>
          <Button
            icon={icons.more}
            title="Actions"
            aria-label="Actions"
            onClick={() => setActions((a) => !a)}
          />
          {actions ? (
            <Menu
              phone={phone}
              ignore={actionsRef}
              onClose={() => setActions(false)}
              items={items}
            />
          ) : null}
        </span>
      ) : null}
      <Button
        icon={icons.command}
        title="Command palette"
        aria-label="Command palette"
        onClick={onPalette}
      />
      {phone ? null : (
        <Button
          icon={dock === 'bottom' ? icons.dockRight : icons.dockBottom}
          title={dock === 'bottom' ? 'Dock right' : 'Dock bottom'}
          aria-label={dock === 'bottom' ? 'Dock right' : 'Dock bottom'}
          onClick={onDock}
        />
      )}
      <Button icon={icons.close} title="Close" aria-label="Close" onClick={onClose} />
    </div>
  )
}
