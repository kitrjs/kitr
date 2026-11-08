import { isKitrError, toKitrError } from '@kitr/core'
import { type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router'

/**
 * The default loading screen: a spinner with "Loading…" for screen readers (`data-kitr="pending"`).
 * `createKitrRouter` uses it for every route; override with `defaultPendingComponent` or a route's `pendingComponent`.
 */
export function DefaultPending() {
  return (
    <div role="status" aria-live="polite" className="kitr-pending" data-kitr="pending">
      <span className="kitr-pending__spinner" />
      <span className="kitr-sr-only">Loading…</span>
    </div>
  )
}

/**
 * The default error screen: the KitrError's message (or "Something went wrong"), a "Try again" button
 * that reloads the route and a "Go home" link. FORBIDDEN errors read "You don't have access to this page."
 */
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

/** The default not-found screen: "Page not found" and a "Go home" link, for unknown URLs and thrown `notFound()`. */
export function DefaultNotFound() {
  return (
    <div className="kitr-not-found" data-kitr="not-found">
      <h2>Page not found</h2>
      <Link to="/">Go home</Link>
    </div>
  )
}
