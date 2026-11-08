import { createApp } from '@kitr/core'
import { createPlatform } from '@kitr/platform'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFiles, selectDriver } from '../src'
import { capacitorFileStore, createCapacitorDriver } from '../src/drivers/capacitor'

const mocks = vi.hoisted(() => ({
  fs: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    deleteFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
  },
  share: { share: vi.fn() },
  picker: { pickFiles: vi.fn() },
}))

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: mocks.fs,
  Directory: {
    Data: 'DATA',
    Documents: 'DOCUMENTS',
    Cache: 'CACHE',
    Library: 'LIBRARY',
    External: 'EXTERNAL',
  },
  Encoding: { UTF8: 'utf8' },
}))
vi.mock('@capacitor/share', () => ({ Share: mocks.share }))
vi.mock('@capawesome/capacitor-file-picker', () => ({ FilePicker: mocks.picker }))

const b64 = (text: string) => btoa(text)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('capacitor open dialog', () => {
  it('shows the picker with MIME types for the filters and wraps the files', async () => {
    mocks.picker.pickFiles.mockResolvedValue({
      files: [
        { name: 'a.txt', size: 5, mimeType: 'text/plain', path: 'content://a', data: b64('hello') },
      ],
    })
    const [file] = await createCapacitorDriver().open({
      filters: [{ name: 'Docs', extensions: ['txt', '.PDF', 'txt'] }],
    })
    expect(mocks.picker.pickFiles).toHaveBeenCalledWith({
      types: ['text/plain', 'application/pdf'],
      limit: 1,
    })
    expect(file).toMatchObject({ name: 'a.txt', size: 5, type: 'text/plain', path: 'content://a' })
    expect(await file?.text()).toBe('hello')
    expect(Array.from((await file?.bytes()) ?? [])).toEqual([104, 101, 108, 108, 111])
    expect(await (await file?.blob())?.text()).toBe('hello')
  })

  it('offers any file for unknown extensions and none, and allows many with multiple', async () => {
    mocks.picker.pickFiles.mockResolvedValue({ files: [] })
    const driver = createCapacitorDriver()
    await driver.open({ multiple: true, filters: [{ name: 'Odd', extensions: ['xyz'] }] })
    await driver.open({ filters: [{ name: 'Any', extensions: ['*'] }] })
    await driver.open({})
    expect(mocks.picker.pickFiles.mock.calls.map((c) => c[0])).toEqual([
      { types: [], limit: 0 },
      { types: [], limit: 1 },
      { types: [], limit: 1 },
    ])
  })

  it('reads picked content from its path with the filesystem plugin', async () => {
    mocks.picker.pickFiles.mockResolvedValue({
      files: [{ name: 'b.bin', size: 2, mimeType: 'application/octet-stream', path: 'file:///b' }],
    })
    mocks.fs.readFile.mockResolvedValueOnce({ data: b64('hi') })
    const [file] = await createCapacitorDriver().open({})
    expect(await file?.text()).toBe('hi')
    expect(mocks.fs.readFile).toHaveBeenCalledWith({ path: 'file:///b' })
    mocks.fs.readFile.mockResolvedValueOnce({ data: new Blob(['yo']) })
    expect(Array.from((await file?.bytes()) ?? [])).toEqual([121, 111])
  })

  it('rejects reading a file with neither data nor a path', async () => {
    mocks.picker.pickFiles.mockResolvedValue({
      files: [{ name: 'c', size: 0, mimeType: '' }],
    })
    const [file] = await createCapacitorDriver().open({})
    await expect(file?.text()).rejects.toThrow('has no path')
  })

  it('resolves [] when the picker is cancelled and rethrows other failures', async () => {
    const driver = createCapacitorDriver()
    mocks.picker.pickFiles.mockRejectedValueOnce(new Error('pickFiles canceled.'))
    expect(await driver.open({})).toEqual([])
    mocks.picker.pickFiles.mockRejectedValueOnce(new Error('no permission'))
    await expect(driver.open({})).rejects.toThrow('no permission')
    mocks.picker.pickFiles.mockRejectedValueOnce('odd')
    await expect(driver.open({})).rejects.toBe('odd')
  })
})

describe('capacitor save dialog', () => {
  it('writes to the cache as base64 and opens the share sheet, resolving to the URI', async () => {
    mocks.fs.writeFile.mockResolvedValue({ uri: 'file:///cache/report.csv' })
    mocks.share.share.mockResolvedValue({})
    const saved = await createCapacitorDriver().save('a,b\n1,2', {
      name: 'report.csv',
      title: 'Save report',
    })
    expect(saved).toBe('file:///cache/report.csv')
    expect(mocks.fs.writeFile).toHaveBeenCalledWith({
      path: 'report.csv',
      directory: 'CACHE',
      data: b64('a,b\n1,2'),
      recursive: true,
    })
    expect(mocks.share.share).toHaveBeenCalledWith({
      title: 'report.csv',
      url: 'file:///cache/report.csv',
      dialogTitle: 'Save report',
    })
  })

  it('saves bytes and blobs too', async () => {
    mocks.fs.writeFile.mockResolvedValue({ uri: 'file:///x' })
    mocks.share.share.mockResolvedValue({})
    const driver = createCapacitorDriver()
    await driver.save(new Uint8Array([1, 2, 3]), { name: 'x.bin' })
    await driver.save(new Blob(['blob']), { name: 'y.txt', type: 'text/plain' })
    expect(mocks.fs.writeFile.mock.calls.map((c) => c[0].data)).toEqual([
      b64('\u0001\u0002\u0003'),
      b64('blob'),
    ])
  })

  it('resolves null when the share sheet is dismissed and rethrows other failures', async () => {
    mocks.fs.writeFile.mockResolvedValue({ uri: 'file:///x' })
    const driver = createCapacitorDriver()
    mocks.share.share.mockRejectedValueOnce(new Error('Share canceled'))
    expect(await driver.save('x', { name: 'x.txt' })).toBeNull()
    mocks.share.share.mockRejectedValueOnce(new Error('disk full'))
    await expect(driver.save('x', { name: 'x.txt' })).rejects.toThrow('disk full')
    mocks.share.share.mockRejectedValueOnce('odd')
    await expect(driver.save('x', { name: 'x.txt' })).rejects.toBe('odd')
  })

  it('reveals a path through the share sheet', async () => {
    await createCapacitorDriver().reveal?.('file:///docs/a.pdf')
    expect(mocks.share.share).toHaveBeenCalledWith({ url: 'file:///docs/a.pdf' })
  })
})

describe('capacitor file store', () => {
  const entry = { name: 'n.txt', type: 'file', size: 3, mtime: 99, uri: 'file:///d/n.txt' }

  it('reads text and bytes under the data directory', async () => {
    const store = capacitorFileStore()
    mocks.fs.readFile.mockResolvedValueOnce({ data: 'plain' })
    expect(await store.readText('n.txt')).toBe('plain')
    expect(mocks.fs.readFile).toHaveBeenLastCalledWith({
      path: 'n.txt',
      directory: 'DATA',
      encoding: 'utf8',
    })
    mocks.fs.readFile.mockResolvedValueOnce({ data: new Blob(['blobbed']) })
    expect(await store.readText('n.txt')).toBe('blobbed')
    mocks.fs.readFile.mockResolvedValueOnce({ data: b64('ab') })
    expect(Array.from(await store.readBytes('n.bin'))).toEqual([97, 98])
    mocks.fs.readFile.mockResolvedValueOnce({ data: new Blob(['cd']) })
    expect(Array.from(await store.readBytes('n.bin'))).toEqual([99, 100])
  })

  it('writes with parent folders and resolves to the URI', async () => {
    mocks.fs.writeFile.mockResolvedValue({ uri: 'file:///d/notes/n.txt' })
    expect(await capacitorFileStore().write('notes/n.txt', 'text')).toBe('file:///d/notes/n.txt')
    expect(mocks.fs.writeFile).toHaveBeenCalledWith({
      path: 'notes/n.txt',
      directory: 'DATA',
      data: b64('text'),
      recursive: true,
    })
  })

  it('deletes, lists, stats and checks existence', async () => {
    const store = capacitorFileStore()
    await store.remove('n.txt')
    expect(mocks.fs.deleteFile).toHaveBeenCalledWith({ path: 'n.txt', directory: 'DATA' })
    mocks.fs.readdir.mockResolvedValue({ files: [entry, { ...entry, name: undefined }] })
    expect(await store.list()).toEqual([
      { name: 'n.txt', type: 'file', size: 3, modifiedAt: 99, uri: 'file:///d/n.txt' },
      { name: 'n.txt', type: 'file', size: 3, modifiedAt: 99, uri: 'file:///d/n.txt' },
    ])
    expect(mocks.fs.readdir).toHaveBeenCalledWith({ path: '', directory: 'DATA' })
    mocks.fs.stat.mockResolvedValue(entry)
    expect(await store.stat('n.txt')).toMatchObject({ name: 'n.txt', modifiedAt: 99 })
    expect(await store.exists('n.txt')).toBe(true)
    mocks.fs.stat.mockRejectedValue(new Error('does not exist'))
    expect(await store.exists('gone')).toBe(false)
  })

  it('uses the directory asked for', async () => {
    mocks.fs.readdir.mockResolvedValue({ files: [] })
    const dirs = {
      documents: 'DOCUMENTS',
      cache: 'CACHE',
      library: 'LIBRARY',
      external: 'EXTERNAL',
    }
    for (const [name, constant] of Object.entries(dirs)) {
      await capacitorFileStore({ directory: name as keyof typeof dirs }).list('sub')
      expect(mocks.fs.readdir).toHaveBeenLastCalledWith({ path: 'sub', directory: constant })
    }
  })
})

describe('driver selection', () => {
  it('selectDriver picks the Capacitor driver', () => {
    expect(selectDriver('capacitor').name).toBe('capacitor')
  })

  it('serves the files service in a Capacitor shell', async () => {
    const app = createApp({ environment: 'test' })
    app.drivers.register('platform', {
      type: 'mobile',
      native: true,
      runtime: 'capacitor',
      os: () => 'ios',
    })
    app.container.singleton('platform', () => createPlatform(app))
    const files = createFiles({}, app)
    expect(files.driver.name).toBe('capacitor')
    mocks.picker.pickFiles.mockResolvedValue({ files: [] })
    expect(await files.pick()).toBeNull()
  })
})
