import { defineStorage } from '@kitr/storage'
import { useStorage } from '@kitr/storage/react'

export const meta = {
  title: 'A preference that survives a reload',
  description:
    'Collapse the sidebar and press Reload. The setting is saved to localStorage with a version.',
}

const sidebar = defineStorage('sidebar', { default: { collapsed: false }, version: 1 })
const recent = defineStorage<string[]>('recent-searches', { default: [], ttl: 60_000 })

const searches = ['invoices due', 'ada', 'refunds', 'ord_1042']

export default function SidebarToggle() {
  const [state, setState] = useStorage(sidebar)
  const [recentSearches, setRecent, clearRecent] = useStorage(recent)
  return (
    <div className="demo">
      <div className="demo-row">
        <button
          type="button"
          className="demo-button primary"
          onClick={() => setState((s) => ({ collapsed: !s.collapsed }))}
        >
          {state.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        </button>
        <button
          type="button"
          className="demo-button"
          onClick={() =>
            setRecent((list) => [searches[list.length % searches.length]!, ...list].slice(0, 4))
          }
        >
          Add a recent search
        </button>
        <button
          type="button"
          className="demo-button"
          onClick={clearRecent}
          disabled={!recentSearches.length}
        >
          Forget them
        </button>
      </div>
      <p className="demo-muted">
        The sidebar is {state.collapsed ? 'collapsed' : 'open'}. Recent searches expire after a
        minute (<span className="mono">ttl</span>).
      </p>
      <ul className="demo-list">
        {recentSearches.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the same search can repeat
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  )
}
