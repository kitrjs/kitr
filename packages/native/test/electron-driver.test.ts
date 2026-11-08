import { afterEach, describe, expect, it, vi } from 'vitest'
import { createNative, selectDriver } from '../src'
import { createElectronDriver } from '../src/drivers/electron'

function fakeBridge(handlers: Record<string, (...args: unknown[]) => unknown> = {}) {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  const invoke = vi.fn(async (channel: string, ...args: unknown[]) => handlers[channel]?.(...args))
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
  return { invoke, push, listeners }
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).kitrIpc
})

describe('electron native driver', () => {
  it('has the clipboard and biometrics, and reports the rest as unsupported', () => {
    fakeBridge()
    const driver = createElectronDriver()
    expect(driver.name).toBe('electron')
    expect(driver.clipboard).not.toBeNull()
    expect(driver.biometrics).not.toBeNull()
    for (const key of ['share', 'haptics', 'geolocation', 'camera'] as const)
      expect(driver[key], key).toBeNull()
  })

  it('reads and writes the clipboard in the main process', async () => {
    const written: string[] = []
    fakeBridge({
      'kitr:native:clipboard-read': () => 'copied',
      'kitr:native:clipboard-write': (text) => void written.push(text as string),
    })
    const { clipboard } = createElectronDriver()
    expect(await clipboard!.readText()).toBe('copied')
    await clipboard!.writeText('hello')
    expect(written).toEqual(['hello'])
  })

  it('asks Touch ID through main, with the reason', async () => {
    const { invoke } = fakeBridge({
      'kitr:native:biometrics-available': () => true,
      'kitr:native:biometrics-prompt': () => true,
    })
    const { biometrics } = createElectronDriver()
    expect(await biometrics!.available()).toBe(true)
    expect(await biometrics!.authenticate({ reason: 'unlock the vault' })).toBe(true)
    expect(invoke).toHaveBeenCalledWith('kitr:native:biometrics-prompt', 'unlock the vault')
    expect(await biometrics!.authenticate()).toBe(true)
    expect(invoke).toHaveBeenLastCalledWith('kitr:native:biometrics-prompt', undefined)
  })

  it('answers system info from main', async () => {
    const { invoke } = fakeBridge({
      'kitr:native:info': () => ({ platform: 'linux', version: '1.2.3', online: true, dark: true }),
      'kitr:app:version': () => '1.2.3',
      'kitr:native:online': () => false,
      'kitr:native:on-battery': () => true,
    })
    const { system } = createElectronDriver()
    expect(await system.platform()).toBe('linux')
    expect(await system.appVersion()).toBe('1.2.3')
    expect(await system.isDark()).toBe(true)
    expect(await system.isOnline()).toBe(false)
    expect(await system.isOnBattery()).toBe(true)
    await system.openExternal('https://acme.com/docs')
    expect(invoke).toHaveBeenCalledWith('kitr:shell:open', 'https://acme.com/docs')
  })

  it('forwards theme and power events and unsubscribes', () => {
    const { push, listeners } = fakeBridge()
    const { system } = createElectronDriver()
    const theme = vi.fn()
    const power = vi.fn()
    const offTheme = system.onTheme(theme)
    const offPower = system.onPower(power)
    push('kitr:native:theme', true)
    push('kitr:native:power', 'suspend')
    push('kitr:native:power', 'battery')
    expect(theme).toHaveBeenCalledWith(true)
    expect(power.mock.calls.map((c) => c[0])).toEqual(['suspend', 'battery'])
    offTheme()
    offPower()
    expect(listeners.get('kitr:native:theme')?.size).toBe(0)
    expect(listeners.get('kitr:native:power')?.size).toBe(0)
  })

  it('throws E_DRIVER_UNAVAILABLE without the preload bridge', () => {
    expect(() => createElectronDriver()).toThrow(
      expect.objectContaining({ code: 'E_DRIVER_UNAVAILABLE' }),
    )
  })

  it('is what selectDriver("electron") returns, and what the service reports as supported', () => {
    fakeBridge()
    expect(selectDriver('electron').name).toBe('electron')
    const service = createNative({
      drivers: {
        clipboard: selectDriver('electron').clipboard!,
        biometrics: selectDriver('electron').biometrics!,
      },
    })
    expect(service.clipboard.supported).toBe(true)
    expect(service.biometrics.supported).toBe(true)
  })
})
