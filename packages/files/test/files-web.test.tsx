import { afterEach, describe, expect, it, vi } from 'vitest'
import { acceptFor, createFiles, createWebFilesDriver, fromFile, mimeFor, toBlob } from '../src'

afterEach(() => {
  const w = window as any
  delete w.showOpenFilePicker
  delete w.showSaveFilePicker
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const abort = () => Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' })

describe('helpers', () => {
  it('mimeFor uses the last extension and ignores names without one', () => {
    expect(mimeFor('archive.tar.zip')).toBe('application/zip')
    expect(mimeFor('pdf')).toBe('application/octet-stream')
    expect(mimeFor('.png')).toBe('application/octet-stream')
    expect(mimeFor('a.unknown', 'text/plain')).toBe('text/plain')
  })

  it('normalises extensions: dots, case, spaces, duplicates and wildcards', () => {
    expect(
      acceptFor([
        { name: 'Images', extensions: ['.PNG', 'png', ' jpg ', '*', ''] },
        { name: 'Docs', extensions: ['pdf', '..jpg'] },
      ]),
    ).toBe('.png,.jpg,.pdf')
    expect(acceptFor()).toBe('')
  })

  it('toBlob handles every input type', async () => {
    expect(await toBlob('hé', 'text/plain').text()).toBe('hé')
    expect((await toBlob(new Uint8Array([1, 2, 3]), 'x').arrayBuffer()).byteLength).toBe(3)
    expect((await toBlob(new Uint8Array([1, 2]).buffer, 'x').arrayBuffer()).byteLength).toBe(2)
    const blob = new Blob(['b'])
    expect(toBlob(blob, 'x')).toBe(blob)
    expect(toBlob('a', 'text/csv').type).toBe('text/csv')
  })

  it('fromFile exposes text, bytes and blob', async () => {
    const file = new File(['abc'], 'a.txt', { type: 'text/plain' })
    const picked = fromFile(file, '/tmp/a.txt')
    expect(picked).toMatchObject({ name: 'a.txt', size: 3, type: 'text/plain', path: '/tmp/a.txt' })
    expect(await picked.text()).toBe('abc')
    expect([...(await picked.bytes())]).toEqual([97, 98, 99])
    expect(await picked.blob()).toBe(file)
  })
})

describe('web driver with the File System Access API', () => {
  it('passes clean picker types and returns the picked files', async () => {
    const showOpenFilePicker = vi.fn(async () => [
      { getFile: async () => new File(['1'], 'one.png') },
      { getFile: async () => new File(['2'], 'two.png') },
    ])
    ;(window as any).showOpenFilePicker = showOpenFilePicker
    const files = await createWebFilesDriver().open({
      multiple: true,
      filters: [
        { name: 'Images', extensions: ['.png', 'JPG'] },
        { name: 'Anything', extensions: ['*'] },
      ],
    })
    expect(files.map((f) => f.name)).toEqual(['one.png', 'two.png'])
    expect(showOpenFilePicker).toHaveBeenCalledWith({
      multiple: true,
      excludeAcceptAllOption: false,
      types: [{ description: 'Images', accept: { 'application/octet-stream': ['.png', '.jpg'] } }],
    })
  })

  it('treats cancel as no files, and other errors as errors', async () => {
    ;(window as any).showOpenFilePicker = vi.fn(async () => Promise.reject(abort()))
    expect(await createWebFilesDriver().open({})).toEqual([])
    ;(window as any).showOpenFilePicker = vi.fn(async () =>
      Promise.reject(Object.assign(new Error('no gesture'), { name: 'SecurityError' })),
    )
    await expect(createWebFilesDriver().open({})).rejects.toThrow('no gesture')
  })

  it('saves through a writable and returns the chosen name; cancel is null', async () => {
    const written: Blob[] = []
    const close = vi.fn()
    ;(window as any).showSaveFilePicker = vi.fn(async () => ({
      name: 'chosen.csv',
      createWritable: async () => ({ write: async (b: Blob) => void written.push(b), close }),
    }))
    const files = createFiles({ driver: createWebFilesDriver() })
    expect(await files.save('a,b', { name: 'report.csv' })).toBe('chosen.csv')
    expect(close).toHaveBeenCalled()
    expect(written[0]!.type).toBe('text/csv')
    expect(await written[0]!.text()).toBe('a,b')
    ;(window as any).showSaveFilePicker = vi.fn(async () => Promise.reject(abort()))
    expect(await files.save('x', { name: 'x.txt' })).toBeNull()
  })
})

describe('web driver fallbacks', () => {
  it('opens through a hidden input with the accept list, and cleans up', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
      this: HTMLInputElement,
    ) {
      Object.defineProperty(this, 'files', { value: [new File(['x'], 'pick.txt')] })
      queueMicrotask(() => this.onchange?.(new Event('change')))
    })
    const promise = createWebFilesDriver().open({
      filters: [{ name: 'Text', extensions: ['txt', 'md'] }],
    })
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    expect(input.accept).toBe('.txt,.md')
    expect(input.multiple).toBe(false)
    const files = await promise
    expect(files.map((f) => f.name)).toEqual(['pick.txt'])
    expect(click).toHaveBeenCalled()
    expect(document.querySelector('input[type=file]')).toBeNull()
  })

  it('resolves [] when the input is cancelled', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
      this: HTMLInputElement,
    ) {
      queueMicrotask(() => (this as any).oncancel?.(new Event('cancel')))
    })
    expect(await createWebFilesDriver().open({})).toEqual([])
    expect(document.querySelector('input[type=file]')).toBeNull()
  })

  it('saves through a download link and revokes the URL later', async () => {
    vi.useFakeTimers()
    const create = vi.fn(() => 'blob:x')
    const revoke = vi.fn()
    URL.createObjectURL = create as never
    URL.revokeObjectURL = revoke as never
    let clicked: HTMLAnchorElement | undefined
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked = this
    })
    expect(await createWebFilesDriver().save(new Uint8Array([1]), { name: 'data.json' })).toBe(
      'data.json',
    )
    expect(clicked?.download).toBe('data.json')
    expect(clicked?.getAttribute('href')).toBe('blob:x')
    expect(document.querySelector('a')).toBeNull()
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revoke).toHaveBeenCalledWith('blob:x')
    vi.useRealTimers()
  })
})
