import type { DevtoolsPanel, KitrApp } from '@kitr/core'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Icon, type IconSvgElement } from '../icon'
import { runAction, visibleActions } from './actions'
import { useEscapeLayer } from './layers'
import { isIconElement, panelIcon } from './panel-icon'
import type { Viewport } from './use-layout'

export interface PaletteItem {
  key: string
  label: string
  /** Muted text on the right: the action's hint, else its panel. */
  hint: string
  /** Extra text matched but not shown. */
  panel?: string
  icon?: ReactNode
  danger?: boolean
  /** Panel switches keep the palette open; everything else closes it. */
  keepOpen?: boolean
  /** Remembered under Recent. */
  recent?: boolean
  run: () => void | Promise<void>
}

/**
 * Subsequence match: every query character must appear in order. Consecutive characters and
 * characters that start a word score extra, and an early start beats a late one. Returns -1
 * when the text does not match.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().replace(/\s+/g, '')
  const t = text.toLowerCase()
  if (!q) return 0
  let score = 0
  let ti = 0
  let prev = -2
  for (const ch of q) {
    const at = t.indexOf(ch, ti)
    if (at < 0) return -1
    const wordStart = at === 0 || !/[a-z0-9]/.test(t[at - 1] ?? ' ')
    score += 1
    if (at === prev + 1) score += 8
    if (wordStart) score += 10
    if (at === 0) score += 6
    score -= Math.min(at - ti, 10) * 0.2
    prev = at
    ti = at + 1
  }
  return score - ti * 0.05
}

function actionIcon(icon: unknown): ReactNode {
  return isIconElement(icon) ? <Icon icon={icon as IconSvgElement} /> : null
}

/** Builds the palette's items: panels, each panel's visible actions, then the devtools commands. */
export function buildItems(
  app: KitrApp,
  panels: DevtoolsPanel[],
  commands: PaletteItem[],
  onPanel: (id: string) => void,
): Array<{ section: string; items: PaletteItem[] }> {
  const sections = [
    {
      section: 'Panels',
      items: panels.map<PaletteItem>((p) => ({
        key: `panel:${p.id}`,
        label: p.label,
        hint: '',
        icon: panelIcon(p),
        keepOpen: true,
        run: () => onPanel(p.id),
      })),
    },
  ]
  for (const p of panels) {
    const actions = visibleActions(p, app)
    if (!actions.length) continue
    sections.push({
      section: p.label,
      items: actions.map<PaletteItem>((a) => ({
        key: `${p.id}:${a.id}`,
        label: a.label,
        hint: a.hint ?? '',
        panel: p.label,
        icon: actionIcon(a.icon),
        danger: a.danger,
        recent: true,
        run: () => runAction(a, app),
      })),
    })
  }
  sections.push({ section: 'Devtools', items: commands })
  return sections
}

/** The command palette: a centred box on desktop, a sheet above the keyboard on phones. */
export function Palette({
  app,
  panels,
  commands,
  recent,
  phone,
  viewport,
  onPanel,
  onRan,
  onClose,
}: {
  app: KitrApp
  panels: DevtoolsPanel[]
  commands: PaletteItem[]
  recent: string[]
  phone: boolean
  viewport: Viewport
  onPanel: (id: string) => void
  onRan: (key: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  useEscapeLayer(onClose)
  useEffect(() => input.current?.focus(), [])

  const groups = useMemo(() => {
    const sections = buildItems(app, panels, commands, onPanel)
    const q = query.trim()
    if (q) {
      const ranked: Array<{ item: PaletteItem; score: number }> = []
      for (const s of sections)
        for (const item of s.items) {
          const score = fuzzyScore(q, `${item.label} ${item.hint} ${item.panel ?? s.section}`)
          if (score >= 0) ranked.push({ item, score })
        }
      ranked.sort((a, b) => b.score - a.score)
      return [{ section: '', items: ranked.map((r) => r.item) }]
    }
    const byKey = new Map(sections.flatMap((s) => s.items).map((i) => [i.key, i]))
    const last = recent.flatMap((k) => {
      const item = byKey.get(k)
      return item ? [{ ...item, key: `recent:${k}` }] : []
    })
    return last.length ? [{ section: 'Recent', items: last }, ...sections] : sections
  }, [app, panels, commands, recent, query, onPanel])

  const flat = groups.flatMap((g) => g.items)
  const active = Math.min(index, flat.length - 1)

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll the highlighted row into view when it moves
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [active, query])

  const choose = async (item: PaletteItem | undefined) => {
    if (!item) return
    if (item.recent || item.key.startsWith('cmd:')) onRan(item.key.replace(/^recent:/, ''))
    if (!item.keepOpen) onClose()
    await item.run()
  }

  const box: React.CSSProperties = phone
    ? { width: '100%', borderRadius: '16px 16px 0 0', height: '100%', maxHeight: '100%' }
    : {}
  const overlay: React.CSSProperties = phone
    ? {
        top: viewport.offsetTop,
        bottom: 'auto',
        height: viewport.height,
        padding: 0,
        alignItems: 'flex-end',
      }
    : {}

  let row = -1
  return (
    <div
      className="kitr-dt-palette"
      style={overlay}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="kitr-dt-palette-box" style={box}>
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="kitr-dt-palette-list"
          aria-activedescendant={flat[active] ? `kitr-dt-opt-${flat[active].key}` : undefined}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Search actions"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setIndex(Math.min(active + 1, flat.length - 1))
            else if (e.key === 'ArrowUp') setIndex(Math.max(active - 1, 0))
            else if (e.key === 'Enter') void choose(flat[active])
            else return
            e.preventDefault()
          }}
        />
        <div
          ref={list}
          id="kitr-dt-palette-list"
          role="listbox"
          style={{ overflowY: 'auto', flex: 1, minHeight: 0, paddingBottom: 4 }}
        >
          {groups.map((g) => (
            // biome-ignore lint/a11y/useSemanticElements: a listbox group is a div; fieldset is for forms
            <div key={g.section || 'results'} role="group" aria-label={g.section || undefined}>
              {g.section ? <div className="kitr-dt-palette-section">{g.section}</div> : null}
              {g.items.map((item) => {
                const i = ++row
                return (
                  <button
                    key={item.key}
                    id={`kitr-dt-opt-${item.key}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={i === active}
                    className={`kitr-dt-palette-item${i === active ? ' kitr-dt-palette-item-active' : ''}`}
                    style={{
                      width: '100%',
                      border: 0,
                      background: 'none',
                      font: 'inherit',
                      color: item.danger ? 'var(--dt-error)' : 'inherit',
                      textAlign: 'left',
                    }}
                    onPointerMove={() => i !== active && setIndex(i)}
                    onClick={() => void choose(item)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                    <span className="kitr-dt-muted">{item.hint || item.panel || ''}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        {phone ? null : (
          <div
            style={{
              display: 'flex',
              gap: 12,
              padding: '6px 12px',
              borderTop: '1px solid var(--dt-border)',
              color: 'var(--dt-muted)',
            }}
          >
            <span className="kitr-dt-kbd">↑↓</span>
            <span className="kitr-dt-kbd">Enter</span>
            <span className="kitr-dt-kbd">Esc</span>
          </div>
        )}
      </div>
    </div>
  )
}
