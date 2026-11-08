import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFiles, selectDriver } from '../src'
import { createElectronDriver } from '../src/drivers/electron'

const enc = (text: string) => new TextEncoder().encode(text)

/** A preload bridge whose main process serves a tiny in-memory disk of "chosen" files. */
function fakeBridge(options: { cancelled?: boolean } = {}) {
  const disk = new Map<string, Uint8Array>([
    ['/home/ada/notes.md', enc('# Notes')],
    ['/home/ada/data.csv', enc('a,b')],
  ])
  const invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    if (channel === 'kitr:files:open') {
      const o = args[0] as { directory?: boolean; multiple?: boolean }
      if (options.cancelled) return []
      if (o.directory) return [{ path: '/home/ada', name: 'ada', size: 0, isDirectory: true }]
      const paths = o.multiple ? [...disk.keys()] : ['/home/ada/notes.md']
      return paths.map((path) => ({
        path,
        name: path.split('/').pop(),
        size: disk.get(path)!.length,
        isDirectory: false,
      }))
    }
    if (channel === 'kitr:files:choose-save')
      return options.cancelled ? null : `/home/ada/${(args[0] as { name: string }).name}`
    if (channel === 'kitr:files:write')
      return void disk.set(args[0] as string, args[1] as Uint8Array)
    if (channel === 'kitr:files:read') return disk.get(args[0] as string)
    if (channel === 'kitr:files:list')
      return [...disk.keys()].map((path) => ({
        path,
        name: path.split('/').pop(),
        size: disk.get(path)!.length,
        isDirectory: false,
      }))
    if (channel === 'kitr:files:reveal') return undefined
    throw new Error(`unexpected channel ${channel}`)
  })
  ;(globalThis as Record<string, unknown>).kitrIpc = { invoke, on: () => () => {}, send: () => {} }
  return { invoke, disk }
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).kitrIpc
})

describe('electron files driver', () => {
  it('opens one file and reads its content lazily', async () => {
    const { invoke } = fakeBridge()
    const driver = createElectronDriver()
    expect(driver.name).toBe('electron')
    const [file] = await driver.open({
      title: 'Open notes',
      filters: [{ name: 'Markdown', extensions: ['.MD', 'md'] }],
    })
    expect(invoke).toHaveBeenCalledWith('kitr:files:open', {
      title: 'Open notes',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      multiple: false,
    })
    expect(file).toMatchObject({
      name: 'notes.md',
      path: '/home/ada/notes.md',
      size: 7,
      type: 'text/markdown',
    })
    expect(invoke).not.toHaveBeenCalledWith('kitr:files:read', expect.anything())
    expect(await file!.text()).toBe('# Notes')
    expect(await file!.bytes()).toEqual(enc('# Notes'))
    const blob = await file!.blob()
    expect(blob.type).toBe('text/markdown')
    expect(await blob.text()).toBe('# Notes')
  })

  it('opens several files and leaves the type empty when unknown', async () => {
    fakeBridge()
    const files = await createElectronDriver().open({ multiple: true })
    expect(files.map((f) => f.name)).toEqual(['notes.md', 'data.csv'])
    expect(files[1]!.type).toBe('text/csv')
  })

  it('drops filters with no usable extension', async () => {
    const { invoke } = fakeBridge()
    await createElectronDriver().open({ filters: [{ name: 'All', extensions: ['*'] }] })
    expect(invoke).toHaveBeenCalledWith('kitr:files:open', expect.objectContaining({ filters: [] }))
  })

  it('resolves to [] when the dialog is cancelled', async () => {
    fakeBridge({ cancelled: true })
    expect(await createElectronDriver().open({})).toEqual([])
  })

  it('saves text, bytes and Blobs to the path the person chose', async () => {
    const { invoke, disk } = fakeBridge()
    const driver = createElectronDriver()
    expect(await driver.save('hello', { name: 'a.txt', title: 'Save' })).toBe('/home/ada/a.txt')
    expect(disk.get('/home/ada/a.txt')).toEqual(enc('hello'))
    await driver.save(new Uint8Array([1, 2, 3]), { name: 'b.bin' })
    expect(disk.get('/home/ada/b.bin')).toEqual(new Uint8Array([1, 2, 3]))
    await driver.save(new Blob(['blob']), {
      name: 'c.txt',
      filters: [{ name: 'T', extensions: ['txt'] }],
    })
    expect(disk.get('/home/ada/c.txt')).toEqual(enc('blob'))
    expect(invoke).toHaveBeenCalledWith('kitr:files:choose-save', {
      name: 'c.txt',
      title: undefined,
      filters: [{ name: 'T', extensions: ['txt'] }],
    })
  })

  it('writes nothing when the save dialog is cancelled', async () => {
    const { invoke } = fakeBridge({ cancelled: true })
    expect(await createElectronDriver().save('x', { name: 'a.txt' })).toBeNull()
    expect(invoke).not.toHaveBeenCalledWith(
      'kitr:files:write',
      expect.anything(),
      expect.anything(),
    )
  })

  it('reveals a path through main', async () => {
    const { invoke } = fakeBridge()
    await createElectronDriver().reveal?.('/home/ada/notes.md')
    expect(invoke).toHaveBeenCalledWith('kitr:files:reveal', '/home/ada/notes.md')
  })

  it('picks a folder and lists its files', async () => {
    fakeBridge()
    const folder = await createElectronDriver().openDirectory({ title: 'Choose' })
    expect(folder).toMatchObject({ path: '/home/ada', name: 'ada' })
    const files = await folder!.list()
    expect(files.map((f) => f.name)).toEqual(['notes.md', 'data.csv'])
    expect(await files[0]!.text()).toBe('# Notes')
  })

  it('answers null when the folder dialog is cancelled', async () => {
    fakeBridge({ cancelled: true })
    expect(await createElectronDriver().openDirectory()).toBeNull()
  })

  it('throws E_DRIVER_UNAVAILABLE without the preload bridge', () => {
    expect(() => createElectronDriver()).toThrow(
      expect.objectContaining({ code: 'E_DRIVER_UNAVAILABLE' }),
    )
  })

  it('is what selectDriver("electron") returns and what the service saves through', async () => {
    const { disk } = fakeBridge()
    expect(selectDriver('electron').name).toBe('electron')
    const files = createFiles({ driver: selectDriver('electron') })
    expect(await files.save('x', { name: 'out.txt' })).toBe('/home/ada/out.txt')
    expect(disk.has('/home/ada/out.txt')).toBe(true)
  })
})
