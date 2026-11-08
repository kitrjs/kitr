import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, icons } from './icons'

/** Everything an example stores is namespaced, so examples never see each other's data. */
export const storagePrefix = (pkg: string, example: string) => `kitr-play:${pkg}:${example}:`

/**
 * A live example in a frame, beside the browser storage it writes. Reload the frame to see what
 * persists; clear its storage to start fresh. An example that stores nothing (`storage: false` in
 * its meta) gets the whole width.
 */
export function LiveExample({
  pkg,
  example,
  title,
  description,
  storage,
  height,
  width,
}: {
  pkg: string
  example: string
  title?: string
  description?: string
  storage?: boolean
  /** Frame height in pixels, for examples that need more than the default 300. */
  height?: number
  /** Frame width in pixels, to show a narrow screen; the frame stays centered and never overflows. */
  width?: number
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [nonce, setNonce] = useState(0)
  const [entries, setEntries] = useState<Array<[string, string]>>([])
  const prefix = storagePrefix(pkg, example)

  const read = useCallback(() => {
    try {
      const out: Array<[string, string]> = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(prefix))
          out.push([key.slice(prefix.length), localStorage.getItem(key) ?? ''])
      }
      setEntries(out)
    } catch {}
  }, [prefix])

  useEffect(() => {
    read()
    // Fires here when the frame (same origin, another document) writes to localStorage.
    const onStorage = () => read()
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [read])

  const reload = () => setNonce((n) => n + 1)
  const clear = () => {
    try {
      for (const [key] of entries) localStorage.removeItem(prefix + key)
    } catch {}
    read()
    reload()
  }
  const src = `/play/${pkg}/${example}`

  return (
    <figure className="example">
      <div className="example-bar">
        <span className="example-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="mono example-url">{src}</span>
        <button type="button" className="example-button" onClick={reload}>
          <Icon icon={icons.refresh} size={15} /> Reload
        </button>
        <a
          className="example-button"
          href={src}
          target="_blank"
          rel="noreferrer"
          aria-label="Open the example in a new tab"
        >
          <Icon icon={icons.external} size={15} />
        </a>
      </div>
      <div
        className={`example-body${storage === false ? ' example-body-wide' : ''}${width ? ' example-body-narrow' : ''}`}
        style={height ? { minHeight: height } : undefined}
      >
        <iframe
          ref={frame}
          key={nonce}
          src={src}
          title={title ?? `${pkg} example`}
          className="example-frame"
          style={{ ...(height ? { minHeight: height } : {}), ...(width ? { width } : {}) }}
          allow="clipboard-write"
          onLoad={read}
        />
        {storage !== false && (
          <aside className="example-storage" aria-label="Browser storage">
            <div className="example-storage-head">
              <span className="label">localStorage</span>
              <button
                type="button"
                className="example-button"
                onClick={clear}
                disabled={!entries.length}
              >
                <Icon icon={icons.trash} size={14} /> Clear
              </button>
            </div>
            {entries.length ? (
              entries.map(([key, value]) => (
                <div key={key} className="example-entry">
                  <span className="mono example-key">{key}</span>
                  <pre className="mono example-value">{pretty(value)}</pre>
                </div>
              ))
            ) : (
              <p className="example-empty">Nothing stored yet. Interact with the example.</p>
            )}
          </aside>
        )}
      </div>
      {description && <figcaption>{description}</figcaption>}
    </figure>
  )
}

function pretty(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}
