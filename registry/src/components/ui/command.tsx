import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { cn } from '@kitr/tailwind'
import { useState, useSyncExternalStore } from 'react'
import { Icon } from '#components/ui/icon'

/** How each package manager runs the project's kitr, and how it runs `kitr new` before a project exists. */
export const managers = {
  npm: { label: 'npm', run: 'npx kitr', create: 'npx @kitr/kitr' },
  pnpm: { label: 'pnpm', run: 'pnpm kitr', create: 'pnpm dlx @kitr/kitr' },
  yarn: { label: 'yarn', run: 'yarn kitr', create: 'yarn dlx @kitr/kitr' },
  bun: { label: 'bun', run: 'bunx kitr', create: 'bunx @kitr/kitr' },
} as const

export type Manager = keyof typeof managers

const KEY = 'kitr:pm'
const EVENT = 'kitr:pm'
const isManager = (value: unknown): value is Manager =>
  typeof value === 'string' && value in managers

function readManager(): Manager {
  try {
    const value = localStorage.getItem(KEY)
    return isManager(value) ? value : 'npm'
  } catch {
    return 'npm'
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange()
  }
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * The package manager the reader picked, remembered in localStorage and shared by every command
 * block on the page (and other tabs). Prerendered HTML uses npm; the choice applies after hydration.
 */
export function useManager(): [Manager, (next: Manager) => void] {
  const manager = useSyncExternalStore(subscribe, readManager, () => 'npm' as const)
  const set = (next: Manager) => {
    try {
      localStorage.setItem(KEY, next)
    } catch {}
    window.dispatchEvent(new Event(EVENT))
  }
  return [manager, set]
}

/** `kitr add content` as the chosen manager runs it; `kitr new` runs before a project exists, so it uses dlx. */
export function withManager(cmd: string, manager: Manager): string {
  return cmd
    .split('\n')
    .map((line) =>
      line.replace(
        /^kitr(?=\s)/,
        /^kitr new\b/.test(line) ? managers[manager].create : managers[manager].run,
      ),
    )
    .join('\n')
}

export interface CommandProps {
  /** One or more `kitr ...` lines. */
  cmd: string
  className?: string
}

/** A copyable `kitr` command with tabs for npm, pnpm, yarn and bun. */
export function Command({ cmd, className }: CommandProps) {
  const [manager, setManager] = useManager()
  const [copied, setCopied] = useState(false)
  const text = withManager(cmd, manager)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }
  return (
    <div className={cn('my-4 overflow-hidden rounded-lg border border-border bg-muted', className)}>
      <div className="flex items-center justify-between border-b border-border px-2">
        <div className="flex" role="tablist" aria-label="Package manager">
          {(Object.keys(managers) as Manager[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={m === manager}
              onClick={() => setManager(m)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
                m === manager ? 'border-primary text-foreground' : 'border-transparent',
              )}
            >
              {managers[m].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy command'}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <Icon icon={copied ? Tick02Icon : Copy01Icon} size={16} />
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-sm">
        <code>{text}</code>
      </pre>
    </div>
  )
}
