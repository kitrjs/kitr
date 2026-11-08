import { useState } from 'react'
import { type Manager, managers, usePm, withManager } from '#app/lib/pm'
import { Icon, icons } from './icons'

/** A copyable `kitr ...` command with the package-manager picker. The choice is remembered site-wide. */
export function Command({ cmd }: { cmd: string }) {
  const pm = usePm((s) => s.pm)
  const setPm = usePm((s) => s.setPm)
  const [copied, setCopied] = useState(false)
  const text = withManager(cmd, pm)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }
  return (
    <div className="command">
      <div className="command-bar">
        <div className="command-tabs" role="tablist" aria-label="Package manager">
          {(Object.keys(managers) as Manager[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={m === pm}
              className="command-tab"
              onClick={() => setPm(m)}
            >
              {managers[m].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="command-copy"
          data-copied={copied || undefined}
          onClick={copy}
          aria-label="Copy command"
        >
          <Icon key={String(copied)} icon={copied ? icons.check : icons.copy} size={16} />
        </button>
      </div>
      <pre className="command-text">
        <code>{text}</code>
      </pre>
      {pm === 'kitr' && (
        <p className="command-note">
          First time? Run <code>npm i -g kitr</code> once. Inside a project, the global{' '}
          <code>kitr</code> runs your project's own version.
        </p>
      )}
    </div>
  )
}
