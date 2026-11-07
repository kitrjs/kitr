import { isKitrError, KitrError, toKitrError } from '@kitr/core'
import { type H3Event, HTTPError } from 'h3'

/** Convert anything thrown in a handler into kitr's wire shape with the right status. */
export function errorToResponse(error: unknown, event?: H3Event): Response {
  const kitrError = normaliseServerError(error)
  const body = kitrError.toJSON()
  if (kitrError.status >= 500 && (globalThis as any).process?.env?.NODE_ENV === 'production') {
    body.message = 'Internal server error'
    body.data = undefined
  }
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' })
  if (event?.res.headers) for (const [k, v] of event.res.headers) headers.set(k, v)
  return new Response(JSON.stringify(body), { status: kitrError.status, headers })
}

/** Turn anything thrown (a KitrError, an h3 HTTPError, a wrapped cause, a plain error) into a KitrError. */
export function normaliseServerError(error: unknown): KitrError {
  if (isKitrError(error)) return toKitrError(error)
  // h3 wraps unknown errors in HTTPError (sometimes with the details object as `cause`);
  // walk the cause chain so a KitrError thrown deep inside keeps its shape.
  let cause = (error as { cause?: unknown } | null)?.cause
  for (let depth = 0; cause && depth < 5; depth++) {
    if (isKitrError(cause)) return toKitrError(cause)
    cause = (cause as { cause?: unknown }).cause
  }
  if (error instanceof HTTPError) {
    const data = (error as any).data
    return KitrError.fromStatus(error.status, error.message, data)
  }
  return toKitrError(error)
}
