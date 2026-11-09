import { useStorage } from '@kitr/storage/react'
import { recent, sidebar } from './sidebar-toggle/app/storage'

export const meta = {
  title: 'A preference that survives a reload',
  description:
    'Collapse the sidebar and press Reload. The setting is saved to localStorage with a version.',
}

const searches = ['invoices due', 'ada', 'refunds', 'ord_1042']

// Tailwind utilities on the kitr tokens, so the example looks the same in any kitr app.
const button =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-border bg-background text-foreground'
const primary =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-primary bg-primary text-primary-foreground'
const list =
  'm-0 list-none rounded-[10px] border border-border p-0 empty:hidden [&>li]:flex [&>li]:justify-between [&>li]:border-b [&>li]:border-border [&>li]:px-3 [&>li]:py-2 [&>li:last-child]:border-b-0'

export default function SidebarToggle() {
  const [state, setState] = useStorage(sidebar)
  const [recentSearches, setRecent, clearRecent] = useStorage(recent)
  return (
    <div className="flex flex-col gap-3 text-[15px]">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={primary}
          onClick={() => setState((s) => ({ collapsed: !s.collapsed }))}
        >
          {state.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        </button>
        <button
          type="button"
          className={button}
          onClick={() =>
            setRecent((list) => [searches[list.length % searches.length]!, ...list].slice(0, 4))
          }
        >
          Add a recent search
        </button>
        <button
          type="button"
          className={button}
          onClick={clearRecent}
          disabled={!recentSearches.length}
        >
          Forget them
        </button>
      </div>
      <p className="m-0 text-muted-foreground">
        The sidebar is {state.collapsed ? 'collapsed' : 'open'}. Recent searches expire after a
        minute (<span className="font-mono">ttl</span>).
      </p>
      <ul className={list}>
        {recentSearches.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the same search can repeat
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  )
}
