import type { DevtoolsPanel, DevtoolsUi, KitrApp } from '@kitr/core'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  getStorageDriver,
  listStorage,
  parseCookies,
  removeStorageKey,
  type StorageArea,
  serializeCookie,
} from './index'

interface Item {
  key: string
  raw: string | null
}

interface Source {
  title: string
  rows: Item[]
  save: (key: string, value: string) => void
  remove: (key: string) => void
  clear: () => void
}

/** The Storage panel: localStorage, sessionStorage and cookies with edit and remove buttons. */
export function panels(ui: DevtoolsUi): DevtoolsPanel[] {
  const { Button, Empty, preview, Row, Section, Toolbar } = ui as typeof import('@kitr/devtools/ui')

  function pretty(raw: string | null) {
    if (raw === null) return ''
    try {
      return JSON.stringify(JSON.parse(raw), null, 2)
    } catch {
      return raw
    }
  }

  function writeCookie(key: string, value: string | null) {
    // biome-ignore lint/suspicious/noDocumentCookie: devtools action
    document.cookie = serializeCookie(key, value)
  }

  function sources(): Source[] {
    const area = (name: StorageArea, title: string): Source => {
      const rows = listStorage(name)
      return {
        title,
        rows,
        save: (key, value) => getStorageDriver(name)?.set(key, value),
        remove: (key) => removeStorageKey(name, key),
        clear: () => {
          for (const { key } of rows) removeStorageKey(name, key)
        },
      }
    }
    const cookies = typeof document === 'undefined' ? {} : parseCookies(document.cookie)
    return [
      area('local', 'localStorage'),
      area('session', 'sessionStorage'),
      {
        title: 'cookies',
        rows: Object.entries(cookies).map(([key, raw]) => ({ key, raw })),
        save: writeCookie,
        remove: (key) => writeCookie(key, null),
        clear: () => {
          for (const key of Object.keys(cookies)) writeCookie(key, null)
        },
      },
    ]
  }

  function StoragePanel({ app }: { app: KitrApp }) {
    const hub = app.container.use('devtools')
    useSyncExternalStore(
      hub.subscribe,
      () => hub.version,
      () => 0,
    )
    // Bumped after every write and on `storage` events, since Web Storage has no change hook of its own.
    const [, tick] = useState(0)
    const refresh = useCallback(() => tick((n) => n + 1), [])
    useEffect(() => {
      window.addEventListener('storage', refresh)
      return () => window.removeEventListener('storage', refresh)
    }, [refresh])

    return (
      <div className="kitr-dt-stack">
        {sources().map((source) => (
          <Section key={source.title} title={source.title} count={source.rows.length}>
            {source.rows.length === 0 ? (
              <Empty>Empty</Empty>
            ) : (
              <>
                <Toolbar>
                  <Button
                    danger
                    onClick={() => {
                      source.clear()
                      refresh()
                    }}
                  >
                    Clear
                  </Button>
                </Toolbar>
                {source.rows.map((row) => (
                  <ValueRow
                    key={row.key}
                    item={row}
                    onSave={(value) => {
                      source.save(row.key, value)
                      refresh()
                    }}
                    onRemove={() => {
                      source.remove(row.key)
                      refresh()
                    }}
                  />
                ))}
              </>
            )}
          </Section>
        ))}
      </div>
    )
  }

  function ValueRow({
    item,
    onSave,
    onRemove,
  }: {
    item: Item
    onSave: (value: string) => void
    onRemove: () => void
  }) {
    const [draft, setDraft] = useState(() => pretty(item.raw))
    // Follow outside changes (another tab, a Save elsewhere) without remounting the row.
    useEffect(() => setDraft(pretty(item.raw)), [item.raw])
    return (
      <Row
        head={
          <>
            <span className="kitr-dt-label kitr-dt-key">{item.key}</span>
            <span className="kitr-dt-preview">{preview(item.raw ?? '')}</span>
          </>
        }
      >
        <textarea
          className="kitr-dt-input"
          aria-label={`Value of ${item.key}`}
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Toolbar>
          <Button onClick={() => onSave(draft)}>Save</Button>
          <Button danger onClick={onRemove}>
            Remove
          </Button>
        </Toolbar>
      </Row>
    )
  }

  return [
    {
      id: 'storage',
      label: 'Storage',
      group: 'data',
      badge: () => {
        const total = listStorage('local').length + listStorage('session').length
        return total ? { value: total, tone: 'muted' } : null
      },
      render: (app) => <StoragePanel app={app} />,
      actions: [
        {
          id: 'clear-local',
          label: 'Clear local',
          hint: 'localStorage',
          danger: true,
          run: () => {
            for (const { key } of listStorage('local')) removeStorageKey('local', key)
          },
        },
        {
          id: 'clear-session',
          label: 'Clear session',
          hint: 'sessionStorage',
          danger: true,
          run: () => {
            for (const { key } of listStorage('session')) removeStorageKey('session', key)
          },
        },
      ],
    },
  ]
}
