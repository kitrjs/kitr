import { createApp } from '@kitr/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import analyticsProvider from '../src/provider'

afterEach(() => vi.restoreAllMocks())

// In development the console adapter and `debug` share one output, so each call prints once.
describe('development console output', () => {
  it('prints a tracked event once', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const app = createApp({
      environment: 'server',
      mode: 'development',
      providers: [analyticsProvider],
    })
    await app.boot()
    app.container.use('analytics').track('signed_up' as never)
    await new Promise((r) => setTimeout(r, 0))
    expect(info.mock.calls.filter((c) => c.includes('signed_up'))).toHaveLength(1)
  })
})
