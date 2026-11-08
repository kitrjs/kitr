import { afterEach, describe, expect, it, vi } from 'vitest'
import { createNotifications, selectDriver } from '../src'
import { createElectronDriver } from '../src/drivers/electron'

/** A preload bridge with recorded invokes and pushable events. */
function fakeBridge(answers: Record<string, unknown> = {}) {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  const invoke = vi.fn(async (channel: string) => answers[channel])
  const off = vi.fn()
  ;(globalThis as Record<string, unknown>).kitrIpc = {
    invoke,
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      listeners.set(channel, (listeners.get(channel) ?? new Set()).add(listener))
      return () => {
        off(channel)
        listeners.get(channel)?.delete(listener)
      }
    },
    send: () => {},
  }
  const push = (channel: string, ...args: unknown[]) => {
    for (const l of listeners.get(channel) ?? []) l(...args)
  }
  return { invoke, push, off, listeners }
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).kitrIpc
})

describe('electron notifications driver', () => {
  it('asks main for the permission, which is granted on desktop', async () => {
    const { invoke } = fakeBridge({ 'kitr:notify:permission': 'granted' })
    const driver = createElectronDriver()
    expect(driver.name).toBe('electron')
    expect(await driver.permission()).toBe('granted')
    expect(await driver.request()).toBe('granted')
    expect(invoke).toHaveBeenCalledWith('kitr:notify:permission')
  })

  it('reports unsupported where the OS has no notification service', async () => {
    fakeBridge({ 'kitr:notify:permission': 'unsupported' })
    expect(await createElectronDriver().permission()).toBe('unsupported')
  })

  it('shows with only the cloneable fields', async () => {
    const { invoke } = fakeBridge()
    await createElectronDriver().show({
      id: 'n1',
      title: 'Order shipped',
      body: 'Order 42',
      url: '/orders/42',
      data: { order: 42 },
      silent: true,
      icon: '/ignored.png',
      channel: 'orders',
    })
    expect(invoke).toHaveBeenCalledWith('kitr:notify:show', {
      id: 'n1',
      title: 'Order shipped',
      body: 'Order 42',
      silent: true,
      url: '/orders/42',
      data: { order: 42 },
    })
  })

  it('schedules in main with the time as a timestamp', async () => {
    const { invoke } = fakeBridge()
    const at = new Date('2030-01-01T10:00:00Z')
    await createElectronDriver().schedule({ id: 'n2', title: 'Later', at })
    expect(invoke).toHaveBeenCalledWith(
      'kitr:notify:schedule',
      expect.objectContaining({ id: 'n2', title: 'Later', at: at.getTime() }),
    )
  })

  it('cancels one, cancels all and lists the pending ids', async () => {
    const { invoke } = fakeBridge({ 'kitr:notify:pending': ['a', 'b'] })
    const driver = createElectronDriver()
    await driver.cancel('a')
    await driver.cancelAll?.()
    expect(invoke).toHaveBeenCalledWith('kitr:notify:cancel', 'a')
    expect(invoke).toHaveBeenCalledWith('kitr:notify:cancel-all')
    expect(await driver.pending?.()).toEqual(['a', 'b'])
  })

  it('answers [] when main lists nothing', async () => {
    fakeBridge()
    expect(await createElectronDriver().pending?.()).toEqual([])
  })

  it('forwards clicks to every tap listener and stops listening after the last one leaves', () => {
    const { push, off, listeners } = fakeBridge()
    const driver = createElectronDriver()
    const first = vi.fn()
    const second = vi.fn()
    const offFirst = driver.onTap(first)
    const offSecond = driver.onTap(second)
    expect(listeners.get('kitr:notify:click')?.size).toBe(1)
    push('kitr:notify:click', { id: 'n1', url: '/orders/42', data: { order: 42 } })
    expect(first).toHaveBeenCalledWith({ id: 'n1', url: '/orders/42', data: { order: 42 } })
    expect(second).toHaveBeenCalledTimes(1)
    offFirst()
    expect(off).not.toHaveBeenCalled()
    push('kitr:notify:click', { id: 'n2' })
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(2)
    offSecond()
    expect(off).toHaveBeenCalledWith('kitr:notify:click')
    // Subscribing again re-attaches.
    driver.onTap(first)
    expect(listeners.get('kitr:notify:click')?.size).toBe(1)
  })

  it('sets the app badge', async () => {
    const { invoke } = fakeBridge()
    await createElectronDriver().setBadge(3)
    expect(invoke).toHaveBeenCalledWith('kitr:notify:badge', 3)
  })

  it('throws E_DRIVER_UNAVAILABLE without the preload bridge', () => {
    expect(() => createElectronDriver()).toThrow(
      expect.objectContaining({ code: 'E_DRIVER_UNAVAILABLE' }),
    )
  })

  it('is what selectDriver("electron") returns and what the service shows through', async () => {
    const { invoke } = fakeBridge({ 'kitr:notify:permission': 'granted' })
    expect(selectDriver('electron').name).toBe('electron')
    const notifications = createNotifications({ driver: selectDriver('electron') })
    const id = await notifications.show({ title: 'Hi' })
    expect(invoke).toHaveBeenCalledWith('kitr:notify:show', expect.objectContaining({ id }))
  })
})
