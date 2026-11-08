import { createApp } from '@kitr/core'
import { createPlatform } from '@kitr/platform'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNotifications, selectDriver } from '../src'
import {
  capacitorPush,
  createCapacitorDriver,
  nativeId,
  toPermission,
} from '../src/drivers/capacitor'

type Handler = (payload: unknown) => void

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, (payload: unknown) => void>()
  const removed: string[] = []
  const addListener = vi.fn(async (event: string, handler: (payload: unknown) => void) => {
    listeners.set(event, handler)
    return { remove: vi.fn(async () => void removed.push(event)) }
  })
  return {
    listeners,
    removed,
    local: {
      checkPermissions: vi.fn(),
      requestPermissions: vi.fn(),
      schedule: vi.fn(),
      cancel: vi.fn(),
      cancelAll: vi.fn(),
      removeDeliveredNotificationsById: vi.fn(),
      removeAllDeliveredNotifications: vi.fn(),
      getPending: vi.fn(),
      createChannel: vi.fn(),
      addListener,
    },
    push: {
      checkPermissions: vi.fn(),
      requestPermissions: vi.fn(),
      register: vi.fn(),
      addListener,
    },
  }
})

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: mocks.local }))
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: mocks.push }))

const fire = (event: string, payload: unknown) => (mocks.listeners.get(event) as Handler)(payload)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listeners.clear()
  mocks.removed.length = 0
  mocks.local.createChannel.mockResolvedValue(undefined)
})

describe('permission mapping', () => {
  it.each([
    ['granted', 'granted'],
    ['denied', 'denied'],
    ['prompt', 'prompt'],
    ['prompt-with-rationale', 'prompt'],
  ] as const)('maps Capacitor %s to %s', (state, expected) => {
    expect(toPermission(state)).toBe(expected)
  })

  it('reads and requests the local notification permission', async () => {
    const driver = createCapacitorDriver()
    mocks.local.checkPermissions.mockResolvedValue({ display: 'prompt-with-rationale' })
    expect(await driver.permission()).toBe('prompt')
    mocks.local.requestPermissions.mockResolvedValue({ display: 'granted' })
    expect(await driver.request()).toBe('granted')
  })
})

describe('nativeId', () => {
  it('is a stable non-negative 32-bit integer per id', () => {
    expect(nativeId('invoice-1')).toBe(nativeId('invoice-1'))
    expect(nativeId('invoice-1')).not.toBe(nativeId('invoice-2'))
    for (const id of ['', 'a', 'a much longer id with ünicode ✓']) {
      const n = nativeId(id)
      expect(Number.isInteger(n)).toBe(true)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(0x7fffffff)
    }
  })
})

describe('capacitor notifications driver', () => {
  it('shows now: a notification without a schedule, carrying the kitr id, url and data', async () => {
    await createCapacitorDriver().show({
      id: 'a',
      title: 'Hello',
      body: 'World',
      url: '/inbox',
      data: { n: 1 },
      silent: true,
    })
    expect(mocks.local.schedule).toHaveBeenCalledWith({
      notifications: [
        {
          id: nativeId('a'),
          title: 'Hello',
          body: 'World',
          channelId: undefined,
          silent: true,
          schedule: undefined,
          extra: { kitrId: 'a', kitrUrl: '/inbox', kitrData: { n: 1 } },
        },
      ],
    })
    expect(mocks.local.createChannel).not.toHaveBeenCalled()
  })

  it('defaults the body to an empty string', async () => {
    await createCapacitorDriver().show({ id: 'b', title: 'T' })
    expect(mocks.local.schedule.mock.calls[0]?.[0].notifications[0].body).toBe('')
  })

  it('schedules at a Date or a timestamp', async () => {
    const driver = createCapacitorDriver()
    const at = new Date('2030-01-01T10:00:00Z')
    await driver.schedule({ id: 's1', title: 'Later', at })
    await driver.schedule({ id: 's2', title: 'Later', at: at.getTime() })
    for (const call of mocks.local.schedule.mock.calls)
      expect(call[0].notifications[0].schedule).toEqual({ at, allowWhileIdle: true })
  })

  it('creates the Android channel once per name', async () => {
    const driver = createCapacitorDriver()
    await driver.show({ id: 'c1', title: 'A', channel: 'news' })
    await driver.show({ id: 'c2', title: 'B', channel: 'news' })
    await driver.show({ id: 'c3', title: 'C', channel: 'alerts' })
    expect(mocks.local.createChannel).toHaveBeenCalledTimes(2)
    expect(mocks.local.createChannel).toHaveBeenCalledWith({
      id: 'news',
      name: 'news',
      importance: 3,
    })
    expect(mocks.local.schedule.mock.calls[0]?.[0].notifications[0].channelId).toBe('news')
  })

  it('still shows on iOS, where creating a channel is unsupported', async () => {
    mocks.local.createChannel.mockRejectedValue(new Error('not implemented on ios'))
    await createCapacitorDriver().show({ id: 'i', title: 'T', channel: 'news' })
    expect(mocks.local.schedule).toHaveBeenCalled()
  })

  it('cancels a pending and a delivered notification by id', async () => {
    await createCapacitorDriver().cancel('a')
    expect(mocks.local.cancel).toHaveBeenCalledWith({ notifications: [{ id: nativeId('a') }] })
    expect(mocks.local.removeDeliveredNotificationsById).toHaveBeenCalledWith({
      ids: [nativeId('a')],
    })
  })

  it('cancels everything, pending and delivered', async () => {
    await createCapacitorDriver().cancelAll?.()
    expect(mocks.local.cancelAll).toHaveBeenCalled()
    expect(mocks.local.removeAllDeliveredNotifications).toHaveBeenCalled()
  })

  it('lists pending ids as kitr ids, falling back to the numeric id', async () => {
    mocks.local.getPending.mockResolvedValue({
      notifications: [{ id: 7, extra: { kitrId: 'seven' } }, { id: 8 }, { id: 9, extra: null }],
    })
    expect(await createCapacitorDriver().pending?.()).toEqual(['seven', '8', '9'])
  })

  it('reports taps from local notifications with the url and data', async () => {
    const taps: unknown[] = []
    createCapacitorDriver().onTap((t) => taps.push(t))
    await vi.waitFor(() =>
      expect(mocks.listeners.has('localNotificationActionPerformed')).toBe(true),
    )
    fire('localNotificationActionPerformed', {
      actionId: 'tap',
      notification: { id: 5, extra: { kitrId: 'five', kitrUrl: '/five', kitrData: { x: 1 } } },
    })
    fire('localNotificationActionPerformed', { actionId: 'tap', notification: { id: 6 } })
    fire('localNotificationActionPerformed', {
      actionId: 'tap',
      notification: { id: 7, extra: { kitrId: 3, kitrUrl: 4, kitrData: 'nope' } },
    })
    expect(taps).toEqual([
      { id: 'five', url: '/five', data: { x: 1 } },
      { id: '6', url: undefined, data: undefined },
      { id: '7', url: undefined, data: undefined },
    ])
  })

  it('reports taps from push notifications, with the url from data or link', async () => {
    const taps: unknown[] = []
    createCapacitorDriver().onTap((t) => taps.push(t))
    await vi.waitFor(() =>
      expect(mocks.listeners.has('pushNotificationActionPerformed')).toBe(true),
    )
    fire('pushNotificationActionPerformed', {
      actionId: 'tap',
      notification: { id: 'p1', data: { url: '/from-data', n: 1 } },
    })
    fire('pushNotificationActionPerformed', {
      actionId: 'tap',
      notification: { id: 'p2', link: '/from-link' },
    })
    expect(taps).toEqual([
      { id: 'p1', url: '/from-data', data: { url: '/from-data', n: 1 } },
      { id: 'p2', url: '/from-link', data: {} },
    ])
  })

  it('listens once however many onTap callers, and unsubscribing stops delivery', async () => {
    const driver = createCapacitorDriver()
    const a = vi.fn()
    const b = vi.fn()
    const offA = driver.onTap(a)
    driver.onTap(b)
    await vi.waitFor(() => expect(mocks.listeners.size).toBe(2))
    expect(mocks.local.addListener).toHaveBeenCalledTimes(2)
    offA()
    fire('localNotificationActionPerformed', { actionId: 'tap', notification: { id: 1 } })
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
  })
})

describe('capacitor push', () => {
  it('maps the receive permission and requests it', async () => {
    const push = capacitorPush()
    mocks.push.checkPermissions.mockResolvedValue({ receive: 'prompt' })
    expect(await push.permission()).toBe('prompt')
    mocks.push.requestPermissions.mockResolvedValue({ receive: 'denied' })
    expect(await push.request()).toBe('denied')
  })

  it('registers and resolves to the device token', async () => {
    mocks.push.register.mockImplementation(async () => {
      queueMicrotask(() => fire('registration', { value: 'tok-123' }))
    })
    expect(await capacitorPush().register()).toBe('tok-123')
    expect(mocks.removed.sort()).toEqual(['registration', 'registrationError'])
  })

  it('rejects when registration fails, in the listener or in register()', async () => {
    mocks.push.register.mockImplementationOnce(async () => {
      queueMicrotask(() => fire('registrationError', { error: 'no google-services.json' }))
    })
    await expect(capacitorPush().register()).rejects.toThrow('no google-services.json')
    mocks.push.register.mockRejectedValueOnce(new Error('bridge down'))
    await expect(capacitorPush().register()).rejects.toThrow('bridge down')
  })

  it('delivers received pushes and stops on unsubscribe', async () => {
    const seen: unknown[] = []
    const off = capacitorPush().onReceived((m) => seen.push(m))
    await vi.waitFor(() => expect(mocks.listeners.has('pushNotificationReceived')).toBe(true))
    fire('pushNotificationReceived', { id: 'm1', title: 'Hi', body: 'There', data: { a: 1 } })
    fire('pushNotificationReceived', { id: 'm2' })
    expect(seen).toEqual([
      { id: 'm1', title: 'Hi', body: 'There', data: { a: 1 } },
      { id: 'm2', title: undefined, body: undefined, data: {} },
    ])
    off()
    await vi.waitFor(() => expect(mocks.removed).toContain('pushNotificationReceived'))
  })

  it('delivers action taps with the action id and url', async () => {
    const seen: unknown[] = []
    capacitorPush().onAction((t) => seen.push(t))
    await vi.waitFor(() =>
      expect(mocks.listeners.has('pushNotificationActionPerformed')).toBe(true),
    )
    fire('pushNotificationActionPerformed', {
      actionId: 'reply',
      notification: { id: 'm1', data: { url: '/chat/1' } },
    })
    fire('pushNotificationActionPerformed', {
      actionId: 'tap',
      notification: { id: 'm2', link: '/chat/2' },
    })
    expect(seen).toEqual([
      { id: 'm1', url: '/chat/1', data: { url: '/chat/1' }, actionId: 'reply' },
      { id: 'm2', url: '/chat/2', data: {}, actionId: 'tap' },
    ])
  })
})

describe('driver selection', () => {
  it('selectDriver picks the Capacitor driver', () => {
    expect(selectDriver('capacitor').name).toBe('capacitor')
  })

  it('serves the notifications service in a Capacitor shell', async () => {
    const app = createApp({ environment: 'test' })
    app.drivers.register('platform', {
      type: 'mobile',
      native: true,
      runtime: 'capacitor',
      os: () => 'android',
    })
    app.container.singleton('platform', () => createPlatform(app))
    const notifications = createNotifications({}, app)
    mocks.local.requestPermissions.mockResolvedValue({ display: 'granted' })
    expect(await notifications.request()).toBe('granted')
    const id = await notifications.show({ title: 'Hi' })
    expect(mocks.local.schedule.mock.calls[0]?.[0].notifications[0].id).toBe(nativeId(id))
  })
})
