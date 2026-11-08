const encoder = new TextEncoder()

/** Options for `signedUrl()`. */
export interface SignedUrlOptions {
  /** Seconds the link works for. */
  expiresIn: number
  /** The signing secret: at least 16 characters, the same on every instance that serves the file. */
  secret: string
  /** The current time in ms; for tests. */
  now?: number
}

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> | undefined => {
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/')
    return Uint8Array.from(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)), (c) =>
      c.charCodeAt(0),
    )
  } catch {
    return undefined
  }
}

const hmacKey = (secret: string, usage: 'sign' | 'verify') => {
  if (secret.length < 16)
    throw new Error('[kitr/uploads] The signing secret must be at least 16 characters.')
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  )
}

/** What gets signed: the decoded path and the expiry, so neither can be changed without the secret. */
const message = (path: string, expires: number) => {
  let decoded = path
  try {
    decoded = decodeURIComponent(path)
  } catch {}
  return encoder.encode(`${decoded}\n${expires}`)
}

/**
 * A link to `path` that works until it expires: `path?expires=<unix seconds>&signature=<HMAC>`.
 * The signature is HMAC-SHA-256 (Web Crypto) over the path and the expiry, so the link works for
 * that file only and only until then. Anyone holding the link can fetch the file, so keep
 * `expiresIn` short and send it only to the person it is for.
 *
 *   signedUrl('/api/uploads/3f2a/report.pdf', { expiresIn: 300, secret })
 */
export async function signedUrl(path: string, options: SignedUrlOptions): Promise<string> {
  const base = path.split('?')[0]!
  const expires = Math.floor(((options.now ?? Date.now()) + options.expiresIn * 1000) / 1000)
  const key = await hmacKey(options.secret, 'sign')
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, message(base, expires)))
  return `${base}?expires=${expires}&signature=${toBase64Url(signature)}`
}

/** Why a signed link was refused, or `ok`; `unsigned` when the request carries no signature at all. */
export type SignatureCheck = 'ok' | 'unsigned' | 'expired' | 'invalid'

/** Check the `expires` and `signature` query parameters of a request URL against `secret`. */
export async function verifySignedUrl(
  url: URL,
  secret: string,
  now = Date.now(),
): Promise<SignatureCheck> {
  const expiresText = url.searchParams.get('expires')
  const signatureText = url.searchParams.get('signature')
  if (expiresText === null && signatureText === null) return 'unsigned'
  const expires = Number(expiresText)
  const signature = signatureText ? fromBase64Url(signatureText) : undefined
  if (!signature || !Number.isInteger(expires) || secret.length < 16) return 'invalid'
  const key = await hmacKey(secret, 'verify')
  // `verify` compares in constant time.
  const valid = await crypto.subtle.verify('HMAC', key, signature, message(url.pathname, expires))
  if (!valid) return 'invalid'
  return expires * 1000 < now ? 'expired' : 'ok'
}
