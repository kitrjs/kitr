/**
 * Password hashing for the cookie-session adapter. `scrypt` from `node:crypto` where it exists
 * (Node, Bun, Deno), PBKDF2-SHA256 through Web Crypto where it does not (Cloudflare Workers).
 * Hashes are self-describing strings, so `verifyPassword` checks either kind whatever this
 * runtime would pick for a new one.
 */

/** PBKDF2 iterations for new Web Crypto hashes, per OWASP's guidance for PBKDF2-HMAC-SHA256. */
export const PBKDF2_ITERATIONS = 600_000
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 } // kitr-allow-module-state: immutable scrypt parameters
const SALT_BYTES = 16

type NodeCrypto = typeof import('node:crypto')
let nodeCrypto: Promise<NodeCrypto | null> | undefined // kitr-allow-module-state: memoised dynamic import of node:crypto
/** `node:crypto` when this runtime has a working `scrypt`, else `null`. Resolved once. */
function loadNodeCrypto(): Promise<NodeCrypto | null> {
  nodeCrypto ??= import('node:crypto')
    .then((m) => (typeof m.scrypt === 'function' ? m : null))
    .catch(() => null)
  return nodeCrypto
}

const encoder = new TextEncoder()

/** base64url without padding, the encoding every token and hash here uses. */
export function toBase64Url(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The bytes of a base64url string. Throws on characters outside the alphabet. */
export function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('[kitr/auth] Not base64url.')
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

/** Compare two byte strings in time that depends only on their length. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  // Length is not secret (every hash of one kind has the same length), so exiting early on it is fine.
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

function scryptAsync(
  crypto: NodeCrypto,
  password: string,
  salt: Uint8Array,
  params: { N: number; r: number; p: number; keylen: number },
): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(
      password.normalize('NFKC'),
      salt,
      params.keylen,
      { N: params.N, r: params.r, p: params.p, maxmem: SCRYPT.maxmem },
      (error, key) => (error ? reject(error) : resolve(new Uint8Array(key))),
    ),
  )
}

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
  bytes = 32,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    bytes * 8,
  )
  return new Uint8Array(bits)
}

/**
 * Hash a password for storage. Uses `scrypt` (N=2^15, r=8, p=1) where `node:crypto` is available
 * and PBKDF2-SHA256 with 600,000 iterations otherwise. The result carries its algorithm,
 * parameters and salt: `scrypt$32768$8$1$<salt>$<hash>` or `pbkdf2-sha256$600000$<salt>$<hash>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const node = await loadNodeCrypto()
  if (node) {
    const hash = await scryptAsync(node, password, salt, SCRYPT)
    return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${toBase64Url(salt)}$${toBase64Url(hash)}`
  }
  return hashPasswordWebCrypto(password)
}

/**
 * Check a password against a stored hash from `hashPassword`, comparing in constant time.
 * Resolves false, never throws, for a malformed or unsupported hash (including a scrypt hash on
 * a runtime without `node:crypto`).
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$')
    if (parts[0] === 'scrypt' && parts.length === 6) {
      const node = await loadNodeCrypto()
      if (!node) return false
      const [, N, r, p, salt, hash] = parts as [string, string, string, string, string, string]
      const expected = fromBase64Url(hash)
      const actual = await scryptAsync(node, password, fromBase64Url(salt), {
        N: Number(N),
        r: Number(r),
        p: Number(p),
        keylen: expected.length,
      })
      return timingSafeEqual(actual, expected)
    }
    if (parts[0] === 'pbkdf2-sha256' && parts.length === 4) {
      const [, iterations, salt, hash] = parts as [string, string, string, string]
      const expected = fromBase64Url(hash)
      const actual = await pbkdf2(
        password,
        fromBase64Url(salt),
        Number(iterations),
        expected.length,
      )
      return timingSafeEqual(actual, expected)
    }
  } catch {
    // A corrupt hash is a failed check, not a server error.
  }
  return false
}

/** True when `stored` was made with weaker settings than `hashPassword` uses now: rehash after a successful sign-in. */
export function needsRehash(stored: string): boolean {
  const parts = stored.split('$')
  if (parts[0] === 'scrypt') return Number(parts[1]) < SCRYPT.N
  if (parts[0] === 'pbkdf2-sha256') return Number(parts[1]) < PBKDF2_ITERATIONS
  return true
}

/** Hash with Web Crypto PBKDF2 whatever the runtime offers: what workers get from `hashPassword`, and what tests use to cover that path. */
export async function hashPasswordWebCrypto(
  password: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await pbkdf2(password, salt, iterations)
  return `pbkdf2-sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(hash)}`
}
