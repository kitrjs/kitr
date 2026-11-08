import { describe, expect, it } from 'vitest'
import {
  fromBase64Url,
  hashPassword,
  hashPasswordWebCrypto,
  needsRehash,
  PBKDF2_ITERATIONS,
  timingSafeEqual,
  toBase64Url,
  verifyPassword,
} from '../src/server'

describe('password hashing', () => {
  it('hashes with scrypt on Node and verifies the right password only', async () => {
    const hash = await hashPassword('correct horse')
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/)
    expect(await verifyPassword('correct horse', hash)).toBe(true)
    expect(await verifyPassword('wrong horse', hash)).toBe(false)
  })

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'))
  })

  it('has a Web Crypto PBKDF2 path for runtimes without scrypt, and verify reads both kinds', async () => {
    const hash = await hashPasswordWebCrypto('workers password', 1000)
    expect(hash).toMatch(/^pbkdf2-sha256\$1000\$/)
    expect(await verifyPassword('workers password', hash)).toBe(true)
    expect(await verifyPassword('nope', hash)).toBe(false)
    expect(PBKDF2_ITERATIONS).toBe(600_000)
  })

  it('uses 600,000 iterations for new PBKDF2 hashes', async () => {
    expect(await hashPasswordWebCrypto('x')).toMatch(/^pbkdf2-sha256\$600000\$/)
  })

  it('normalises unicode, so composed and decomposed passwords match', async () => {
    const hash = await hashPassword('café')
    expect(await verifyPassword('café', hash)).toBe(true)
  })

  it('answers false, never throws, for malformed hashes', async () => {
    for (const bad of ['', 'plain', 'scrypt$1$2', 'scrypt$x$y$z$!!$!!', 'pbkdf2-sha256$1$a', 'bcrypt$10$abc']) {
      expect(await verifyPassword('pw', bad)).toBe(false)
    }
  })

  it('asks for a rehash when settings are weaker than today', async () => {
    expect(needsRehash(await hashPassword('x'))).toBe(false)
    expect(needsRehash('scrypt$1024$8$1$aaaa$bbbb')).toBe(true)
    expect(needsRehash(await hashPasswordWebCrypto('x', 1000))).toBe(true)
    expect(needsRehash('pbkdf2-sha256$600000$aaaa$bbbb')).toBe(false)
    expect(needsRehash('md5$abc')).toBe(true)
  })

  it('compares bytes in constant time and rejects different lengths', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false)
    expect(timingSafeEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false)
  })

  it('round-trips base64url and refuses other alphabets', () => {
    const bytes = new Uint8Array([251, 255, 0, 1, 2, 250])
    expect(toBase64Url(bytes)).not.toMatch(/[+/=]/)
    expect([...fromBase64Url(toBase64Url(bytes))]).toEqual([...bytes])
    expect(() => fromBase64Url('a+b')).toThrow()
  })
})
