import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMemoryNotificationsDriver,
  createNotifications,
  createWebNotificationsDriver,
  notificationId,
} from '../src'

class FakeNotification {
  static permission: string = 'granted'
  static requestPermission = vi.fn(async () => FakeNotification.permission)
  static instances: FakeNotification[] = []
  static throwOnConstruct = false
  onclick: (() => void) | null = null
  onclose: (() => void) | null = null
  closed = false
  constructor(
    public title: string,
    public options: Record<string, any>,
  ) {
    if (FakeNotification.throwOnConstruct) throw new TypeError('Illegal constructor')
    FakeNotification.instances.push(this)
  }
  close() {
    this.closed = true
    this.onclose?.()
  }
}

beforeEach(() => {
  FakeNotification.permission = 'granted'
  FakeNotification.instances = []
  FakeNotification.throwOnConstruct = false
  vi.stubGlobal('Notification', FakeNotification)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('web notifications', () => {
  it('maps permission states, and unsupported without the API', async () => {
    const driver = createWebNotificationsDriver()
    for (const [native, ours] of [
      ['granted', 'granted'],
      ['denied', 'denied'],
      ['default', 'prompt'],
    ]) {
      FakeNotification.permission = native!
      expect(await driver.permission()).toBe(ours)
      expect(await driver.request()).toBe(ours)
    }
    vi.stubGlobal('Notification', undefined)
    expect(await driver.permission()).toBe('unsupported')
    expect(await driver.request()).toBe('unsupported')
  })

  it('shows with the defaults, replaces by id and reports taps with the url', async () => {
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {})
    const n = createNotifications({ driver: createWebNotificationsDriver({ icon: '/icon.png' }) })
    const taps: unknown[] = []
    n.onTap((t) => taps.push(t))
    await n.show({ id: 'msg', title: 'One', url: '/inbox/1' })
    await n.show({ id: 'msg', title: 'Two', url: '/inbox/2', data: { k: 1 } })
    const [first, second] = FakeNotification.instances
    expect(first!.closed).toBe(true)
    expect(second!.options).toMatchObject({ icon: '/icon.png', tag: 'msg' })
    second!.onclick!()
    expect(focus).toHaveBeenCalled()
    expect(second!.closed).toBe(true)
    expect(taps).toEqual([{ id: 'msg', url: '/inbox/2', data: { k: 1 } }])
  })

  it('shows nothing without permission', async () => {
    FakeNotification.permission = 'denied'
    await createWebNotificationsDriver().show({ id: 'x', title: 'Hi' })
    expect(FakeNotification.instances).toHaveLength(0)
  })

  it('falls back to the service worker where the constructor is not allowed', async () => {
    FakeNotification.throwOnConstruct = true
    const showNotification = vi.fn(async () => {})
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: {}, ready: Promise.resolve({ showNotification }) },
    })
    try {
      await createWebNotificationsDriver().show({ id: 'sw', title: 'Hello', body: 'b' })
      expect(showNotification).toHaveBeenCalledWith(
        'Hello',
        expect.objectContaining({ body: 'b', tag: 'sw' }),
      )
      Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined })
      await expect(createWebNotificationsDriver().show({ id: 'x', title: 'x' })).rejects.toThrow(
        /Illegal/,
      )
    } finally {
      Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined })
    }
  })

  it('schedules, lists pending, cancels one and all', async () => {
    vi.useFakeTimers()
    const n = createNotifications({ driver: createWebNotificationsDriver() })
    const a = await n.schedule({ title: 'A', at: Date.now() + 1000 })
    await n.schedule({ id: 'b', title: 'B', at: new Date(Date.now() + 2000) })
    await n.schedule({ id: 'c', title: 'C', at: Date.now() + 3000 })
    expect(await n.pending()).toEqual([a, 'b', 'c'])
    await n.cancel('b')
    await vi.advanceTimersByTimeAsync(1000)
    expect(FakeNotification.instances.map((i) => i.title)).toEqual(['A'])
    expect(await n.pending()).toEqual(['c'])
    await n.cancelAll()
    await vi.advanceTimersByTimeAsync(5000)
    expect(FakeNotification.instances.map((i) => i.title)).toEqual(['A'])
  })

  it('schedules far in the future without firing early', async () => {
    vi.useFakeTimers()
    const driver = createWebNotificationsDriver()
    const day = 86_400_000
    await driver.schedule({ id: 'far', title: 'Renewal', at: Date.now() + 40 * day })
    await vi.advanceTimersByTimeAsync(1000)
    expect(FakeNotification.instances).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(39 * day)
    expect(FakeNotification.instances).toHaveLength(0)
    expect(await driver.pending!()).toEqual(['far'])
    await vi.advanceTimersByTimeAsync(day)
    expect(FakeNotification.instances).toHaveLength(1)
    expect(await driver.pending!()).toEqual([])
  })

  it('a past time shows right away; rescheduling an id replaces it', async () => {
    vi.useFakeTimers()
    const driver = createWebNotificationsDriver()
    await driver.schedule({ id: 'x', title: 'Old', at: Date.now() + 1000 })
    await driver.schedule({ id: 'x', title: 'New', at: Date.now() - 5 })
    await vi.advanceTimersByTimeAsync(2000)
    expect(FakeNotification.instances.map((i) => i.title)).toEqual(['New'])
  })

  it('rejects an invalid time instead of showing at once', async () => {
    const n = createNotifications({ driver: createMemoryNotificationsDriver() })
    await expect(n.schedule({ title: 'x', at: new Date('nope') })).rejects.toThrow(/valid `at`/)
    await expect(n.schedule({ title: 'x', at: Number.NaN })).rejects.toThrow()
  })
})

describe('service', () => {
  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, notificationId))
    expect(ids.size).toBe(1000)
  })

  it('cancelAll falls back to cancelling each pending id', async () => {
    const memory = createMemoryNotificationsDriver()
    const { cancelAll: _drop, ...driver } = memory
    const n = createNotifications({ driver })
    await n.schedule({ id: 'a', title: 'a', at: Date.now() + 1000 })
    await n.schedule({ id: 'b', title: 'b', at: Date.now() + 1000 })
    await n.cancelAll()
    expect(await n.pending()).toEqual([])
  })

  it('unsubscribing a tap listener stops it', async () => {
    const driver = createMemoryNotificationsDriver()
    const n = createNotifications({ driver })
    const listener = vi.fn()
    const off = n.onTap(listener)
    await n.show({ id: 'x', title: 'x', url: '/x' })
    driver.tap('x')
    off()
    driver.tap('x')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ id: 'x', url: '/x', data: undefined })
  })

  it('memory driver: prompt becomes granted on request, denied stays denied', async () => {
    const prompt = createMemoryNotificationsDriver('prompt')
    expect(await prompt.request()).toBe('granted')
    const denied = createMemoryNotificationsDriver('denied')
    expect(await denied.request()).toBe('denied')
  })
})
