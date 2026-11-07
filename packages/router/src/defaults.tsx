import { isKitrError, toKitrError } from '@kitr/core'
import { type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router'

/**
 * Default route-level components. Generated routes reference these so every
 * page has a loading, error and not-found state without anyone deciding each time.
 * Override globally in `createKitrRouter({ defaultPendingComponent })` or per route.
 */
export function DefaultPending() {
  return (
    <div role="status" aria-live="polite" className="kitr-pending" data-kitr="pending">
      <span className="kitr-pending__spinner" />
      <span className="kitr-sr-only">Loading…</span>
    </div>
  )
}

export function DefaultError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const err = toKitrError(error)
  const title = isKitrError(error) ? err.message : 'Something went wrong'
  return (
    <div role="alert" className="kitr-error" data-kitr="error" data-code={err.code}>
      <h2 className="kitr-error__title">{title}</h2>
      {err.code === 'FORBIDDEN' ? (
        <p>You don't have access to this page.</p>
      ) : (
        <p className="kitr-error__message">{err.message}</p>
      )}
      <div className="kitr-error__actions">
        <button
          type="button"
          onClick={() => {
            router.invalidate()
            reset()
          }}
        >
          Try again
        </button>
        <Link to="/">Go home</Link>
      </div>
    </div>
  )
}

export function DefaultNotFound() {
  return (
    <div className="kitr-not-found" data-kitr="not-found">
      <h2>Page not found</h2>
      <Link to="/">Go home</Link>
    </div>
  )
}
