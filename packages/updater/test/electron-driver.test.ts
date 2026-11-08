import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUpdater, selectDriver } from '../src'
import { createElectronDriver } from '../src/drivers/electron'

function fakeBridge(handlers: Record<string, () => unknown> = {}) {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  const calls: string[] = []
  const invoke = vi.fn(async (channel: string) => {
    calls.push(channel)
    return handlers[channel]?.()
  })
  ;(globalThis as Record<string, unknown>).kitrIpc = {
    invoke,
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      listeners.set(channel, (listeners.get(channel) ?? new Set()).add(listener))
      return () => listeners.get(channel)?.delete(listener)
    },
    send: () => {},
  }
  const push = (channel: string, ...args: unknown[]) => {
    for (const l of listeners.get(channel) ?? []) l(...args)
  }
  return { invoke, calls, push, listeners }
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).kitrIpc
})

describe('electron updater driver', () => {
  it('checks through electron-updater and returns the update or null', async () => {
    const update = { version: '2.0.0', notes: 'Faster', date: '2030-01-01', size: 1024 }
    fakeBridge({ 'kitr:updater:check': () => update })
    expect(await createElectronDriver().check()).toEqual(update)
    fakeBridge({ 'kitr:updater:check': () => null })
    expect(await createElectronDriver().check()).toBeNull()
    fakeBridge()
    expect(await createElectronDriver().check()).toBeNull()
  })

  it('downloads with progress, then quits and installs', async () => {
    const { calls, push } = fakeBridge({
      'kitr:updater:download': () => {
        push('kitr:updater:progress', 0.25)
        push('kitr:updater:progress', 1)
      },
    })
    const progress: number[] = []
    await createElectronDriver().apply((f) => progress.push(f))
    expect(progress).toEqual([0.25, 1])
    expect(calls).toEqual(['kitr:updater:download', 'kitr:updater:install'])
  })

  it('stops listening to progress when the download fails, and does not install', async () => {
    const { calls, listeners } = fakeBridge({
      'kitr:updater:download': () => {
        throw new Error('network down')
      },
    })
    await expect(createElectronDriver().apply(() => {})).rejects.toThrow('network down')
    expect(listeners.get('kitr:updater:progress')?.size).toBe(0)
    expect(calls).not.toContain('kitr:updater:install')
  })

  it('applies without a progress callback', async () => {
    const { calls, listeners } = fakeBridge()
    await createElectronDriver().apply()
    expect(listeners.size).toBe(0)
    expect(calls).toEqual(['kitr:updater:download', 'kitr:updater:install'])
  })

  it('announces updates main finds on its own, and stops on unsubscribe', () => {
    const { push } = fakeBridge()
    const seen: string[] = []
    const off = createElectronDriver().onAvailable!((info) => seen.push(info.version))
    push('kitr:updater:available', { version: '2.1.0' })
    off()
    push('kitr:updater:available', { version: '2.2.0' })
    expect(seen).toEqual(['2.1.0'])
  })

  it('reports the running version', async () => {
    fakeBridge({ 'kitr:app:version': () => '1.4.2' })
    expect(await createElectronDriver().currentVersion!()).toBe('1.4.2')
  })

  it('turns a missing electron-updater in main into E_DRIVER_UNAVAILABLE', async () => {
    const missing = () => {
      throw new Error(
        "Error invoking remote method 'kitr:updater:check': Error: E_DRIVER_UNAVAILABLE: electron-updater is not installed",
      )
    }
    fakeBridge({ 'kitr:updater:check': missing, 'kitr:updater:download': missing })
    const driver = createElectronDriver()
    const error = await driver.check().catch((e) => e)
    expect(error).toMatchObject({ code: 'E_DRIVER_UNAVAILABLE' })
    expect(error.message).toContain('electron-updater')
    expect(error.message).toContain('@kitr/updater')
    await expect(driver.apply()).rejects.toMatchObject({ code: 'E_DRIVER_UNAVAILABLE' })
  })

  it('passes other main-process errors through untouched', async () => {
    fakeBridge({
      'kitr:updater:check': () => {
        throw new Error('404 latest.yml')
      },
    })
    await expect(createElectronDriver().check()).rejects.toThrow('404 latest.yml')
  })

  it('throws E_DRIVER_UNAVAILABLE without the preload bridge', () => {
    expect(() => createElectronDriver()).toThrow(
      expect.objectContaining({ code: 'E_DRIVER_UNAVAILABLE' }),
    )
  })

  it('is what selectDriver("electron") returns and drives the service flow', async () => {
    fakeBridge({
      'kitr:updater:check': () => ({ version: '2.0.0' }),
      'kitr:app:version': () => '1.0.0',
    })
    expect(selectDriver('electron').name).toBe('electron-updater')
    const updater = createUpdater({ driver: selectDriver('electron') })
    await vi.waitFor(() => expect(updater.state.currentVersion).toBe('1.0.0'))
    expect((await updater.check())?.version).toBe('2.0.0')
    await updater.apply()
    expect(updater.state.status).toBe('ready')
    updater.stop()
  })
})
