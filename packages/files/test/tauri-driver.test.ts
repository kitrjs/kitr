import { registerShellModules } from '@kitr/platform'
import { describe, expect, it, vi } from 'vitest'
import { selectDriver } from '../src'
import { createTauriDriver } from '../src/drivers/tauri'

const enc = (text: string) => new TextEncoder().encode(text)

function fakePlugins(chosen: { open?: string | string[] | null; save?: string | null } = {}) {
  const disk = new Map<string, Uint8Array>([
    ['/home/ada/notes.md', enc('# Notes')],
    ['C:\\Users\\ada\\data.csv', enc('a,b')],
  ])
  const dialog = {
    open: vi.fn(async () => chosen.open ?? null),
    save: vi.fn(async () => chosen.save ?? null),
  }
  const fs = {
    readFile: vi.fn(async (path: string) => disk.get(path)!),
    writeFile: vi.fn(async (path: string, data: Uint8Array) => void disk.set(path, data)),
    stat: vi.fn(async (path: string) => ({ size: disk.get(path)?.length ?? 0 })),
  }
  const opener = { openPath: vi.fn(async () => {}) }
  registerShellModules({
    '@tauri-apps/plugin-dialog': async () => dialog,
    '@tauri-apps/plugin-fs': async () => fs,
    '@tauri-apps/plugin-opener': async () => opener,
  })
  return { dialog, fs, opener, disk }
}

describe('tauri files driver', () => {
  it('is returned by selectDriver("tauri")', () => {
    expect(selectDriver('tauri').name).toBe('tauri')
  })

  it('opens one file and reads it through plugin-fs on demand', async () => {
    const { dialog, fs } = fakePlugins({ open: '/home/ada/notes.md' })
    const [file] = await createTauriDriver().open({
      title: 'Open',
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Any', extensions: ['*'] },
      ],
    })
    expect(dialog.open).toHaveBeenCalledWith({
      title: 'Open',
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    expect(file).toMatchObject({
      name: 'notes.md',
      path: '/home/ada/notes.md',
      size: 7,
      type: 'text/markdown',
    })
    expect(fs.readFile).not.toHaveBeenCalled()
    expect(await file!.text()).toBe('# Notes')
    expect(await file!.bytes()).toEqual(enc('# Notes'))
    expect(await (await file!.blob()).text()).toBe('# Notes')
  })

  it('opens several files, including a Windows path', async () => {
    fakePlugins({ open: ['/home/ada/notes.md', 'C:\\Users\\ada\\data.csv'] })
    const files = await createTauriDriver().open({ multiple: true })
    expect(files.map((f) => f.name)).toEqual(['notes.md', 'data.csv'])
    expect(files[1]!.type).toBe('text/csv')
  })

  it('resolves to [] when the dialog is cancelled', async () => {
    fakePlugins({ open: null })
    expect(await createTauriDriver().open({})).toEqual([])
  })

  it('saves text, bytes and Blobs where the person chose', async () => {
    const { dialog, disk } = fakePlugins({ save: '/home/ada/out.txt' })
    const driver = createTauriDriver()
    expect(await driver.save('hello', { name: 'out.txt', title: 'Save' })).toBe('/home/ada/out.txt')
    expect(disk.get('/home/ada/out.txt')).toEqual(enc('hello'))
    expect(dialog.save).toHaveBeenCalledWith({ title: 'Save', defaultPath: 'out.txt', filters: [] })
    await driver.save(new Blob(['blob']), { name: 'out.txt', type: 'text/plain' })
    expect(disk.get('/home/ada/out.txt')).toEqual(enc('blob'))
  })

  it('writes nothing when the save dialog is cancelled', async () => {
    const { fs } = fakePlugins({ save: null })
    expect(await createTauriDriver().save('x', { name: 'a.txt' })).toBeNull()
    expect(fs.writeFile).not.toHaveBeenCalled()
  })

  it('reveals a path with the opener plugin', async () => {
    const { opener } = fakePlugins()
    await createTauriDriver().reveal?.('/home/ada/notes.md')
    expect(opener.openPath).toHaveBeenCalledWith('/home/ada/notes.md')
  })

  it.each([
    ['@tauri-apps/plugin-dialog', (d: ReturnType<typeof createTauriDriver>) => d.open({})],
    [
      '@tauri-apps/plugin-fs',
      (d: ReturnType<typeof createTauriDriver>) => d.save('x', { name: 'a' }),
    ],
    ['@tauri-apps/plugin-opener', (d: ReturnType<typeof createTauriDriver>) => d.reveal!('/a')],
  ])('rejects with E_DRIVER_UNAVAILABLE naming %s when it is missing', async (missing, call) => {
    fakePlugins()
    registerShellModules({
      [missing]: async () => {
        throw new Error('Cannot find module')
      },
    })
    const driver = createTauriDriver()
    const error = await call(driver).catch((e: unknown) => e as Error)
    expect(error).toMatchObject({ code: 'E_DRIVER_UNAVAILABLE' })
    expect((error as Error).message).toContain(missing)
    expect((error as Error).message).toContain('@kitr/files')
    // Installing it afterwards works: a failed load is not cached.
    fakePlugins({ open: null })
    expect(await driver.open({})).toEqual([])
  })
})
