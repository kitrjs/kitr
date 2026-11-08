import { registerShellModules } from '@kitr/platform'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { selectDriver } from '../src'
import { createTauriDriver, numericId } from '../src/drivers/tauri'

const PLUGIN = '@tauri-apps/plugin-notification'

function fakePlugin(overrides: Record<string, unknown> = {}) {
  let granted = false
  const plugin = {
    isPermissionGranted: vi.fn(async () => granted),
    requestPermission: vi.fn(async () => {
      granted = true
      return 'granted' as const
    }),
    sendNotification: vi.fn(),
    cancel: vi.fn(async () => {}),
    removeActive: vi.fn(async () => {}),
    onAction: vi.fn(async () => ({ unregister: vi.fn(async () => {}) })),
    ...overrides,
  }
  registerShellModules({ [PLUGIN]: async () => plugin })
  return plugin
}

afterEach(() => {
  vi.useRealTimers()
})

describe('tauri notifications driver', () => {
  it('is returned by selectDriver("tauri") without loading the plugin', () => {
    registerShellModules({
      [PLUGIN]: async () => {
        throw new Error('should not load')
      },
    })
    expect(selectDriver('tauri').name).toBe('tauri')
  })

  it('maps the plugin permission: granted, prompt, denied', async () => {
    const plugin = fakePlugin()
    const driver = createTauriDriver()
    expect(await driver.permission()).toBe('prompt')
    expect(await driver.request()).toBe('granted')
    expect(await driver.permission()).toBe('granted')
    // Already granted: no second prompt.
    plugin.requestPermission.mockClear()
    expect(await driver.request()).toBe('granted')
    expect(plugin.requestPermission).not.toHaveBeenCalled()

    fakePlugin({ requestPermission: async () => 'denied' })
    expect(await createTauriDriver().request()).toBe('denied')
    fakePlugin({ requestPermission: async () => 'default' })
    expect(await createTauriDriver().request()).toBe('prompt')
  })

  it('shows through sendNotification with a numeric id and the tap payload in extra', async () => {
    const plugin = fakePlugin()
    await createTauriDriver().show({
      id: 'order-42',
      title: 'Shipped',
      body: 'Order 42',
      icon: '/i.png',
      silent: true,
      url: '/orders/42',
      data: { order: 42 },
    })
    expect(plugin.sendNotification).toHaveBeenCalledWith({
      id: numericId('order-42'),
      title: 'Shipped',
      body: 'Order 42',
      icon: '/i.png',
      silent: true,
      extra: { id: 'order-42', url: '/orders/42', data: { order: 42 } },
    })
    expect(Number.isInteger(numericId('order-42'))).toBe(true)
    expect(numericId('order-42')).not.toBe(numericId('order-43'))
  })

  it('schedules in a timer, shows at the time, and lists it as pending until then', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
    const plugin = fakePlugin()
    const driver = createTauriDriver()
    await driver.schedule({ id: 'later', title: 'Later', at: Date.now() + 60_000 })
    expect(await driver.pending?.()).toEqual(['later'])
    await vi.advanceTimersByTimeAsync(59_000)
    expect(plugin.sendNotification).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(plugin.sendNotification).toHaveBeenCalledTimes(1)
    expect(await driver.pending?.()).toEqual([])
  })

  it('waits in steps for a time beyond the setTimeout limit', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
    const plugin = fakePlugin()
    const driver = createTauriDriver()
    const thirtyDays = 30 * 24 * 3600 * 1000
    await driver.schedule({ id: 'far', title: 'Far', at: Date.now() + thirtyDays })
    await vi.advanceTimersByTimeAsync(2 ** 31 - 1)
    expect(plugin.sendNotification).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(thirtyDays)
    expect(plugin.sendNotification).toHaveBeenCalledTimes(1)
  })

  it('swallows a failed delayed display', async () => {
    vi.useFakeTimers()
    fakePlugin({
      sendNotification: () => {
        throw new Error('no permission')
      },
    })
    const driver = createTauriDriver()
    await driver.schedule({ id: 'x', title: 'X', at: Date.now() })
    await vi.advanceTimersByTimeAsync(10)
    expect(await driver.pending?.()).toEqual([])
  })

  it('cancel clears the timer and withdraws the notification; cancelAll clears every timer', async () => {
    vi.useFakeTimers()
    const plugin = fakePlugin()
    const driver = createTauriDriver()
    await driver.schedule({ id: 'a', title: 'A', at: Date.now() + 1000 })
    await driver.schedule({ id: 'b', title: 'B', at: Date.now() + 1000 })
    await driver.cancel('a')
    expect(plugin.removeActive).toHaveBeenCalledWith([{ id: numericId('a') }])
    expect(plugin.cancel).toHaveBeenCalledWith([numericId('a')])
    expect(await driver.pending?.()).toEqual(['b'])
    await driver.cancelAll?.()
    expect(await driver.pending?.()).toEqual([])
    await vi.advanceTimersByTimeAsync(5000)
    expect(plugin.sendNotification).not.toHaveBeenCalled()
  })

  it('cancel works where the plugin has no mobile-only calls, and where they fail', async () => {
    fakePlugin({ cancel: undefined, removeActive: undefined })
    await createTauriDriver().cancel('a')
    fakePlugin({
      cancel: async () => {
        throw new Error('desktop')
      },
      removeActive: async () => {
        throw new Error('desktop')
      },
    })
    await expect(createTauriDriver().cancel('a')).resolves.toBeUndefined()
  })

  it('passes taps from the plugin to listeners and unregisters', async () => {
    let action: ((n: { extra?: Record<string, unknown> }) => void) | undefined
    const unregister = vi.fn(async () => {})
    fakePlugin({
      onAction: async (l: typeof action) => {
        action = l
        return { unregister }
      },
    })
    const listener = vi.fn()
    const off = createTauriDriver().onTap(listener)
    await vi.waitFor(() => expect(action).toBeDefined())
    action?.({ extra: { id: 'n', url: '/x', data: { a: 1 } } })
    expect(listener).toHaveBeenCalledWith({ id: 'n', url: '/x', data: { a: 1 } })
    action?.({})
    expect(listener).toHaveBeenLastCalledWith({})
    off()
    await vi.waitFor(() => expect(unregister).toHaveBeenCalled())
  })

  it('unregisters at once when the listener left before the plugin loaded', async () => {
    const unregister = vi.fn(async () => {})
    fakePlugin({ onAction: async () => ({ unregister }) })
    createTauriDriver().onTap(() => {})()
    await vi.waitFor(() => expect(unregister).toHaveBeenCalled())
  })

  it('stays quiet on desktop, where the plugin has no onAction', async () => {
    fakePlugin({ onAction: undefined })
    const off = createTauriDriver().onTap(() => {})
    await new Promise((r) => setTimeout(r, 0))
    expect(() => off()).not.toThrow()
  })

  it('stays quiet when the plugin is missing for taps', async () => {
    registerShellModules({
      [PLUGIN]: async () => {
        throw new Error('missing')
      },
    })
    const off = createTauriDriver().onTap(() => {})
    await new Promise((r) => setTimeout(r, 0))
    expect(() => off()).not.toThrow()
  })

  it('rejects with E_DRIVER_UNAVAILABLE naming the plugin when it is not installed', async () => {
    registerShellModules({
      [PLUGIN]: async () => {
        throw new Error('Cannot find module')
      },
    })
    const driver = createTauriDriver()
    const error = await driver.permission().catch((e) => e)
    expect(error).toMatchObject({ code: 'E_DRIVER_UNAVAILABLE' })
    expect(error.message).toContain(PLUGIN)
    expect(error.message).toContain('@kitr/notifications')
    await expect(driver.show({ id: 'a', title: 'A' })).rejects.toMatchObject({
      code: 'E_DRIVER_UNAVAILABLE',
    })
    // Installing it later works: the failed load is not cached.
    fakePlugin()
    expect(await driver.permission()).toBe('prompt')
  })
})
