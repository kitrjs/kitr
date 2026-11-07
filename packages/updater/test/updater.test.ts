import { createApp } from '@kitr/core'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryUpdaterDriver, createUpdater } from '../src'
import updaterProvider from '../src/provider'

describe('updater', () => {
  it('checks, applies with progress and reports state', async () => {
    const driver = createMemoryUpdaterDriver({ version: '1.0.0', next: { version: '1.1.0' } })
    const updater = createUpdater({ driver })
    const seen: string[] = []
    updater.subscribe(() => seen.push(updater.state.status))
    expect(await updater.check()).toEqual({ version: '1.1.0' })
    expect(updater.state.status).toBe('available')
    await updater.apply()
    expect(updater.state).toMatchObject({ status: 'ready', progress: 1 })
    expect(driver.applied).toEqual([{ version: '1.1.0' }])
    expect(seen).toContain('downloading')
    expect(await updater.check()).toBeNull()
    expect(updater.state.status).toBe('up-to-date')
  })

  it('dismisses a version and reacts to driver announcements', async () => {
    const driver = createMemoryUpdaterDriver()
    const updater = createUpdater({ driver })
    driver.announce({ version: '2.0.0' })
    expect(updater.state.update?.version).toBe('2.0.0')
    updater.dismiss()
    expect(updater.state.update).toBeNull()
    driver.announce({ version: '2.0.0' })
    expect(updater.state.update).toBeNull()
    driver.announce({ version: '2.0.1' })
    expect(updater.state.update?.version).toBe('2.0.1')
  })

  it('applies automatically and checks on boot through the provider', async () => {
    const driver = createMemoryUpdaterDriver({ next: { version: '3.0.0' } })
    const app = createApp({
      environment: 'client',
      providers: [updaterProvider],
      config: { updater: { auto: true } },
    })
    app.drivers.register('updater', driver)
    await app.boot()
    await vi.waitFor(() => expect(driver.applied).toEqual([{ version: '3.0.0' }]))
    await app.shutdown()
  })
})
