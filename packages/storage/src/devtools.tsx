import type { DevtoolsPanel } from '@kitr/core'
import { listStorage, parseCookies, removeStorageKey, serializeCookie } from './index'

/** The Storage panel: localStorage, sessionStorage and cookies with remove buttons. */
export function panels(): DevtoolsPanel[] {
  return [
    {
      id: 'storage',
      label: 'Storage',
      badge: () => listStorage('local').length + listStorage('session').length,
      render: () => <StoragePanel />,
      actions: [
        {
          id: 'clear-local',
          label: 'Clear localStorage',
          run: () => {
            for (const { key } of listStorage('local')) removeStorageKey('local', key)
          },
        },
        {
          id: 'clear-session',
          label: 'Clear sessionStorage',
          run: () => {
            for (const { key } of listStorage('session')) removeStorageKey('session', key)
          },
        },
      ],
    },
  ]
}

function pretty(raw: string | null) {
  if (raw === null) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 1)
  } catch {
    return raw
  }
}

function StoragePanel() {
  const cookies = typeof document === 'undefined' ? {} : parseCookies(document.cookie)
  const sections: Array<{
    title: string
    rows: Array<{ key: string; raw: string | null; remove: () => void }>
  }> = [
    {
      title: 'localStorage',
      rows: listStorage('local').map((r) => ({
        ...r,
        remove: () => removeStorageKey('local', r.key),
      })),
    },
    {
      title: 'sessionStorage',
      rows: listStorage('session').map((r) => ({
        ...r,
        remove: () => removeStorageKey('session', r.key),
      })),
    },
    {
      title: 'cookies',
      rows: Object.entries(cookies).map(([key, raw]) => ({
        key,
        raw,
        remove: () => {
          // biome-ignore lint/suspicious/noDocumentCookie: devtools action
          document.cookie = serializeCookie(key, null)
        },
      })),
    },
  ]
  return (
    <div className="kitr-dt-stack">
      {sections.map((section) => (
        <section key={section.title}>
          <h4 className="kitr-dt-h">
            {section.title} <span className="kitr-dt-muted">({section.rows.length})</span>
          </h4>
          {section.rows.length === 0 ? (
            <p className="kitr-dt-muted">empty</p>
          ) : (
            <table className="kitr-dt-table">
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.key}>
                    <td className="kitr-dt-key">{row.key}</td>
                    <td>
                      <pre className="kitr-dt-pre">{pretty(row.raw)}</pre>
                    </td>
                    <td>
                      <button type="button" className="kitr-dt-btn" onClick={row.remove}>
                        remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  )
}
