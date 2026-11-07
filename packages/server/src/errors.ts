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

export function normaliseServerError(error: unknown): KitrError {
  if (isKitrError(error)) return toKitrError(error)
  // h3 wraps unknown errors in HTTPError; unwrap a KitrError cause so the shape survives.
  const cause = (error as { cause?: unknown } | null)?.cause
  if (cause && isKitrError(cause)) return toKitrError(cause)
  if (error instanceof HTTPError) {
    const data = (error as any).data
    return KitrError.fromStatus(error.status, error.message, data)
  }
  return toKitrError(error)
}
