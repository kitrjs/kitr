/**
 * The one error shape every kitr data source produces: external APIs,
 * server actions, kitr API routes and socket channels all normalise to this.
 */
export type FieldErrors = Record<string, string[]>

export interface KitrErrorShape {
  /** Machine-readable code, e.g. `VALIDATION`, `UNAUTHORIZED`, `NOT_FOUND`. */
  code: string
  /** Human-readable message. Safe to show to users. */
  message: string
  /** HTTP-style status. */
  status: number
  /** Validation errors keyed by field path (`'email'`, `'items.0.name'`). */
  fieldErrors?: FieldErrors
  /** Extra structured details. Never contains secrets. */
  data?: unknown
}

export type KitrErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'UNAVAILABLE'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'PAYLOAD_TOO_LARGE'
  | (string & {})

// kitr-allow-module-state: lookup table built once at import, never mutated
const defaultStatus: Record<string, number> = {
  BAD_REQUEST: 400,
  VALIDATION: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  UNAVAILABLE: 503,
  NETWORK: 0,
  TIMEOUT: 408,
  PAYLOAD_TOO_LARGE: 413,
}

// kitr-allow-module-state: lookup table built once at import, never mutated
const statusToCode: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  408: 'TIMEOUT',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'VALIDATION',
  429: 'RATE_LIMITED',
  500: 'INTERNAL',
  503: 'UNAVAILABLE',
}

export class KitrError extends Error implements KitrErrorShape {
  readonly code: KitrErrorCode
  readonly status: number
  readonly fieldErrors?: FieldErrors
  readonly data?: unknown
  /** Marker so instances survive bundling/realm boundaries. */
  readonly __kitrError = true as const

  constructor(
    code: KitrErrorCode,
    message?: string,
    options: { status?: number; fieldErrors?: FieldErrors; data?: unknown; cause?: unknown } = {},
  ) {
    super(message ?? humanize(code), { cause: options.cause })
    this.name = 'KitrError'
    this.code = code
    this.status = options.status ?? defaultStatus[code] ?? 500
    if (options.fieldErrors) this.fieldErrors = options.fieldErrors
    if (options.data !== undefined) this.data = options.data
  }

  /** Plain JSON for the wire. Shape is stable across kitr versions. */
  toJSON(): KitrErrorShape {
    const shape: KitrErrorShape = { code: this.code, message: this.message, status: this.status }
    if (this.fieldErrors) shape.fieldErrors = this.fieldErrors
    if (this.data !== undefined) shape.data = this.data
    return shape
  }

  static validation(fieldErrors: FieldErrors, message = 'Validation failed'): KitrError {
    return new KitrError('VALIDATION', message, { fieldErrors })
  }
  static notFound(what = 'Resource'): KitrError {
    return new KitrError('NOT_FOUND', `${what} not found`)
  }
  static unauthorized(message = 'Authentication required'): KitrError {
    return new KitrError('UNAUTHORIZED', message)
  }
  static forbidden(message = 'Not allowed'): KitrError {
    return new KitrError('FORBIDDEN', message)
  }
  static fromStatus(status: number, message?: string, data?: unknown): KitrError {
    const code = statusToCode[status] ?? (status >= 500 ? 'INTERNAL' : 'BAD_REQUEST')
    return new KitrError(code, message, { status, data })
  }
}

function humanize(code: string): string {
  return code
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
}

export function isKitrError(value: unknown): value is KitrError {
  return (
    value instanceof KitrError ||
    (typeof value === 'object' && value !== null && (value as any).__kitrError === true)
  )
}

export function isKitrErrorShape(value: unknown): value is KitrErrorShape {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).code === 'string' &&
    typeof (value as any).message === 'string' &&
    typeof (value as any).status === 'number'
  )
}

/**
 * Normalise anything thrown anywhere into a KitrError.
 * Already-KitrErrors pass through; wire shapes are revived; the rest is INTERNAL.
 */
export function toKitrError(value: unknown, fallback: KitrErrorCode = 'INTERNAL'): KitrError {
  if (isKitrError(value)) {
    if (value instanceof KitrError) return value
    const v = value as unknown as KitrErrorShape
    return new KitrError(v.code, v.message, {
      status: v.status,
      fieldErrors: v.fieldErrors,
      data: v.data,
    })
  }
  if (isKitrErrorShape(value)) {
    return new KitrError(value.code, value.message, {
      status: value.status,
      fieldErrors: value.fieldErrors,
      data: value.data,
    })
  }
  if (value instanceof Error) {
    const anyErr = value as any
    if (typeof anyErr.status === 'number' || typeof anyErr.statusCode === 'number') {
      return KitrError.fromStatus(anyErr.status ?? anyErr.statusCode, value.message, anyErr.data)
    }
    // AbortError from fetch; TimeoutError and NetworkError are what ky v2 throws.
    if (value.name === 'AbortError' || value.name === 'TimeoutError')
      return new KitrError('TIMEOUT', value.message, { cause: value })
    if (value.name === 'NetworkError')
      return new KitrError('NETWORK', 'Network request failed', { cause: value })
    if (value.name === 'TypeError' && /fetch/i.test(value.message)) {
      return new KitrError('NETWORK', 'Network request failed', { cause: value })
    }
    return new KitrError(fallback, value.message, { cause: value })
  }
  return new KitrError(fallback, typeof value === 'string' ? value : undefined, { data: value })
}
