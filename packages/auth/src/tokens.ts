import { fromBase64Url, toBase64Url } from './password'

/** What a token is for. A token made for one purpose never verifies for another. */
export type TokenPurpose = 'verify-email' | 'reset-password'

/** The signing half of `CookieSessions`: the email-link tokens are signed with the session secret. */
export interface TokenSigner {
  sign(value: string): Promise<string>
  unsign(signed: string): Promise<string | null>
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 * A signed, expiring token for the email links (`verify-email`, `reset-password`): no store
 * needed, the signature (HMAC-SHA256 with the session secret) is the proof. `binding` ties the
 * token to something that changes once it has been used, such as the current password hash, so a
 * reset link works once.
 */
export async function createToken(
  signer: TokenSigner,
  purpose: TokenPurpose,
  subject: string,
  ttlSeconds: number,
  binding = '',
): Promise<string> {
  const payload = { p: purpose, s: subject, e: Date.now() + ttlSeconds * 1000, b: binding }
  return signer.sign(toBase64Url(encoder.encode(JSON.stringify(payload))))
}

/** The subject of a token when it is genuine, unexpired, for `purpose` and bound to `binding`; else `null`. */
export async function readToken(
  signer: TokenSigner,
  purpose: TokenPurpose,
  token: string,
  binding?: (subject: string) => Promise<string> | string,
): Promise<string | null> {
  const body = await signer.unsign(token)
  if (!body) return null
  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(body))) as {
      p: string
      s: string
      e: number
      b: string
    }
    if (payload.p !== purpose || payload.e <= Date.now()) return null
    if (binding && (await binding(payload.s)) !== payload.b) return null
    return payload.s
  } catch {
    return null
  }
}

/** A short stable fingerprint of a string (the first bytes of its SHA-256), for token bindings. */
export async function fingerprint(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return toBase64Url(new Uint8Array(digest).slice(0, 12))
}
