import { registerShellModules } from '@kitr/platform'
import { describe, expect, it, vi } from 'vitest'
import { selectDriver } from '../src'
import { createTauriDriver } from '../src/drivers/tauri'

type Event = {
  event: 'Started' | 'Progress' | 'Finished'
  data?: { contentLength?: number; chunkLength?: number }
}

function fakePlugins(
  update: { events?: Event[] } | null = { events: [] },
  extra: { relaunch?: () => Promise<void> } = {},
) {
  const downloadAndInstall = vi.fn(async (onEvent?: (e: Event) => void) => {
    for (const e of update?.events ?? []) onEvent?.(e)
  })
  const found = update
    ? { version: '2.0.0', body: 'Notes', date: '2030-01-01T00:00:00Z', downloadAndInstall }
    : null
  const check = vi.fn(async () => found)
  const relaunch = vi.fn(extra.relaunch ?? (async () => {}))
  registerShellModules({
    '@tauri-apps/plugin-updater': async () => ({ check }),
    '@tauri-apps/plugin-process': async () => ({ relaunch }),
    '@tauri-apps/api/app': async () => ({ getVersion: async () => '1.0.0' }),
  })
  return { check, downloadAndInstall, relaunch }
}

describe('tauri updater driver', () => {
  it('is returned by selectDriver("tauri")', () => {
    expect(selectDriver('tauri').name).toBe('tauri-updater')
  })

  it('maps the plugin update to UpdateInfo, and null when current', async () => {
    fakePlugins()
    expect(await createTauriDriver().check()).toEqual({
      version: '2.0.0',
      notes: 'Notes',
      date: '2030-01-01T00:00:00Z',
    })
    fakePlugins(null)
    expect(await createTauriDriver().check()).toBeNull()
  })

  it('downloads with progress as a fraction, then relaunches', async () => {
    const { downloadAndInstall, relaunch, check } = fakePlugins({
      events: [
        { event: 'Started', data: { contentLength: 200 } },
        { event: 'Progress', data: { chunkLength: 50 } },
        { event: 'Progress', data: { chunkLength: 100 } },
        { event: 'Progress', data: { chunkLength: 100 } },
        { event: 'Finished' },
      ],
    })
    const driver = createTauriDriver()
    await driver.check()
    const progress: number[] = []
    await driver.apply((f) => progress.push(f))
    expect(progress).toEqual([0.25, 0.75, 1, 1])
    expect(downloadAndInstall).toHaveBeenCalledTimes(1)
    expect(check).toHaveBeenCalledTimes(1)
    expect(relaunch).toHaveBeenCalledTimes(1)
  })

  it('reports no fractions when the server sends no content length, and works without a callback', async () => {
    const { relaunch } = fakePlugins({
      events: [
        { event: 'Started', data: {} },
        { event: 'Progress', data: { chunkLength: 10 } },
      ],
    })
    const driver = createTauriDriver()
    const progress: number[] = []
    await driver.apply((f) => progress.push(f))
    expect(progress).toEqual([])
    await driver.apply()
    expect(relaunch).toHaveBeenCalledTimes(2)
  })

  it('checks first when apply() runs before check(), and does nothing when current', async () => {
    const { check, relaunch } = fakePlugins(null)
    await createTauriDriver().apply()
    expect(check).toHaveBeenCalledTimes(1)
    expect(relaunch).not.toHaveBeenCalled()
  })

  it('reads the running version', async () => {
    fakePlugins()
    expect(await createTauriDriver().currentVersion!()).toBe('1.0.0')
  })

  it.each([
    ['@tauri-apps/plugin-updater', (d: ReturnType<typeof createTauriDriver>) => d.check()],
    ['@tauri-apps/plugin-process', (d: ReturnType<typeof createTauriDriver>) => d.apply()],
    ['@tauri-apps/api/app', (d: ReturnType<typeof createTauriDriver>) => d.currentVersion!()],
  ])('rejects with E_DRIVER_UNAVAILABLE naming %s when it is missing', async (missing, call) => {
    fakePlugins()
    registerShellModules({
      [missing]: async () => {
        throw new Error('Cannot find module')
      },
    })
    const error = await call(createTauriDriver()).catch((e: unknown) => e as Error)
    expect(error).toMatchObject({ code: 'E_DRIVER_UNAVAILABLE' })
    expect((error as Error).message).toContain(missing)
    expect((error as Error).message).toContain('@kitr/updater')
  })
})
