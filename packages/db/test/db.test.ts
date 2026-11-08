import { createApp } from '@kitr/core'
import { describe, expect, it, vi } from 'vitest'
import { dbProvider, defineDb, useDb } from '../src'

describe('dbProvider', () => {
  it('connects on boot, runs onReady and disconnects on shutdown', async () => {
    const conn = { query: vi.fn() }
    const def = defineDb({
      connect: vi.fn(async () => conn),
      onReady: vi.fn(),
      disconnect: vi.fn(),
    })
    const app = createApp({ providers: [dbProvider], config: { db: def } })
    await app.boot()
    expect(def.connect).toHaveBeenCalledOnce()
    expect(useDb<typeof conn>(app)).toBe(conn)
    await app.ready()
    expect(def.onReady).toHaveBeenCalledWith(conn, app)
    await app.shutdown()
    expect(def.disconnect).toHaveBeenCalledWith(conn, app)
  })

  it('fails boot with a clear error when the connection fails', async () => {
    const app = createApp({
      providers: [dbProvider],
      config: { db: defineDb({ connect: () => Promise.reject(new Error('ECONNREFUSED')) }) },
    })
    await expect(app.boot()).rejects.toThrow('ECONNREFUSED')
  })

  it('explains a missing config/db.ts', async () => {
    const app = createApp({ providers: [dbProvider] })
    await expect(app.boot()).rejects.toThrow(/config\/db\.ts/)
  })
})
