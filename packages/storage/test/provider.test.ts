import { createApp } from '@kitr/core'
import { afterEach, describe, expect, it } from 'vitest'
import { defineCookie, defineStorage, setCookieDefaults, setStoragePrefix } from '../src'
import storageProvider from '../src/provider'
import { cookies } from '../src/server'

afterEach(() => {
  setStoragePrefix('')
  setCookieDefaults({})
})

describe('storage provider', () => {
  it('applies the key prefix and cookie defaults from config, including to items defined earlier', async () => {
    const theme = defineCookie('theme', { default: 'light' })
    const app = createApp({
      providers: [storageProvider],
      config: { storage: { prefix: 'app:', cookie: { secure: true, maxAge: 60 } } },
    })
    await app.boot()
    const res = new Headers()
    const jar = cookies(new Request('http://x', { headers: { cookie: 'app:theme=dark' } }), res)
    expect(jar.get(theme)).toBe('dark')
    jar.set(theme, 'light')
    const set = res.get('set-cookie') ?? ''
    expect(set).toMatch(/^app:theme=light;/)
    expect(set).toContain('Max-Age=60')
    expect(set).toContain('Secure')
    jar.remove(theme)
    expect(res.get('set-cookie')).toContain('Max-Age=0')
  })

  it('is a no-op without config and on the server', async () => {
    const item = defineStorage('n', { default: 1 })
    const app = createApp({ providers: [storageProvider] })
    await expect(app.boot()).resolves.toBeDefined()
    expect(item.get()).toBe(1)
    item.set(2)
    expect(item.get()).toBe(1)
  })
})
