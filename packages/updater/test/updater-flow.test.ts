import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryUpdaterDriver, createUpdater, type UpdaterDriver } from '../src'

afterEach(() => {
  vi.useRealTimers()
})

function slowDriver() {
  let finish: () => void = () => {}
  const apply = vi.fn(
    (onProgress?: (f: number) => void) =>
      new Promise<void>((resolve) => {
        onProgress?.(0.25)
        finish = () => {
          onProgress?.(1)
          resolve()
        }
      }),
  )
  const driver: UpdaterDriver = {
    name: 'slow',
    check: vi.fn(async () => ({ version: '2.0.0' })),
    apply,
  }
  return { driver, apply, finish: () => finish() }
}

describe('updater flow', () => {
  it('goes checking → available → downloading → ready, with progress', async () => {
    const { driver, finish } = slowDriver()
    const updater = createUpdater({ driver })
    const statuses: string[] = []
    updater.subscribe(() => statuses.push(updater.state.status))
    await updater.check()
    const applying = updater.apply()
    expect(updater.state).toMatchObject({ status: 'downloading', progress: 0.25 })
    finish()
    await applying
    expect(updater.state).toMatchObject({ status: 'ready', progress: 1 })
    expect(statuses.filter((s, i) => s !== statuses[i - 1])).toEqual([
      'checking',
      'available',
      'downloading',
      'ready',
    ])
  })

  it('applies once, however many times it is asked', async () => {
    const { driver, apply, finish } = slowDriver()
    const updater = createUpdater({ driver })
    await updater.check()
    const a = updater.apply()
    const b = updater.apply()
    finish()
    await Promise.all([a, b])
    await updater.apply()
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('an interval check does not interrupt a download', async () => {
    vi.useFakeTimers()
    const { driver, finish } = slowDriver()
    const updater = createUpdater({ driver, interval: 100 })
    await updater.check()
    const applying = updater.apply()
    await vi.advanceTimersByTimeAsync(350)
    expect(updater.state.status).toBe('downloading')
    expect(driver.check).toHaveBeenCalledTimes(1)
    finish()
    await applying
    await vi.advanceTimersByTimeAsync(350)
    expect(updater.state.status).toBe('ready')
    updater.stop()
  })

  it('stop() ends the interval and the driver listener', async () => {
    vi.useFakeTimers()
    const driver = createMemoryUpdaterDriver()
    const check = vi.spyOn(driver, 'check')
    const updater = createUpdater({ driver, interval: 50 })
    await vi.advanceTimersByTimeAsync(120)
    expect(check).toHaveBeenCalledTimes(2)
    updater.stop()
    await vi.advanceTimersByTimeAsync(500)
    expect(check).toHaveBeenCalledTimes(2)
    driver.announce({ version: '9.0.0' })
    expect(updater.state.status).not.toBe('available')
  })

  it('records check and apply errors without throwing', async () => {
    const updater = createUpdater({
      driver: {
        name: 'broken',
        check: async () => Promise.reject('offline'),
        apply: async () => {
          throw new Error('disk full')
        },
      },
    })
    expect(await updater.check()).toBeNull()
    expect(updater.state.status).toBe('error')
    expect(updater.state.error?.message).toBe('offline')

    const failing = createUpdater({
      driver: {
        name: 'x',
        check: async () => ({ version: '2' }),
        apply: async () => Promise.reject(new Error('disk full')),
      },
    })
    await failing.check()
    await failing.apply()
    expect(failing.state).toMatchObject({ status: 'error' })
    expect(failing.state.error?.message).toBe('disk full')
    // A later check clears the error.
    await failing.check()
    expect(failing.state).toMatchObject({ status: 'available', error: null })
  })

  it('dismiss hides this version but not the next one', async () => {
    const driver = createMemoryUpdaterDriver({ next: { version: '2.0.0' } })
    const updater = createUpdater({ driver })
    await updater.check()
    updater.dismiss()
    expect(updater.state.status).toBe('up-to-date')
    await updater.check()
    expect(updater.state.status).toBe('up-to-date')
    driver.announce({ version: '2.0.0' })
    expect(updater.state.status).toBe('up-to-date')
    driver.announce({ version: '2.1.0' })
    expect(updater.state).toMatchObject({ status: 'available', update: { version: '2.1.0' } })
  })

  it('auto applies updates found by a check or announced by the driver', async () => {
    const driver = createMemoryUpdaterDriver({ next: { version: '2.0.0' } })
    const updater = createUpdater({ driver, auto: true })
    await updater.check()
    expect(driver.applied).toEqual([{ version: '2.0.0' }])
    expect(updater.state.status).toBe('ready')
  })

  it('a driver whose version lookup fails does not cause an unhandled rejection', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      createUpdater({
        driver: {
          name: 'x',
          check: async () => null,
          apply: async () => {},
          currentVersion: () => Promise.reject(new Error('no')),
        },
      })
      await new Promise((r) => setTimeout(r, 20))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('reports the current version and nothing to apply when up to date', async () => {
    const driver = createMemoryUpdaterDriver({ version: '1.2.3' })
    const updater = createUpdater({ driver })
    await vi.waitFor(() => expect(updater.state.currentVersion).toBe('1.2.3'))
    expect(await updater.check()).toBeNull()
    await updater.apply()
    expect(updater.state.status).toBe('up-to-date')
    expect(driver.applied).toEqual([])
  })
})
