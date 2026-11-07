import { createApp } from '@kitr/core'
import { describe, expect, it } from 'vitest'
import { acceptFor, createFiles, createMemoryFilesDriver, fromFile, mimeFor } from '../src'
import filesProvider from '../src/provider'

describe('files', () => {
  it('maps extensions to mime types and accept strings', () => {
    expect(mimeFor('report.PDF')).toBe('application/pdf')
    expect(mimeFor('blob')).toBe('application/octet-stream')
    expect(acceptFor([{ name: 'Images', extensions: ['png', 'jpg'] }])).toBe('.png,.jpg')
  })

  it('opens, picks and saves through the driver with config filters merged in', async () => {
    const driver = createMemoryFilesDriver([
      fromFile(new File(['hello'], 'a.txt', { type: 'text/plain' })),
      fromFile(new File(['world'], 'b.txt', { type: 'text/plain' })),
    ])
    const files = createFiles({ driver, filters: [{ name: 'Text', extensions: ['txt'] }] })
    const one = await files.pick()
    expect(one?.name).toBe('a.txt')
    expect(await one?.text()).toBe('hello')
    const rest = await files.open({ multiple: true })
    expect(rest.map((f) => f.name)).toEqual(['b.txt'])
    expect(await files.save('x', { name: 'out.txt' })).toBe('out.txt')
    expect(driver.saved[0]).toMatchObject({ name: 'out.txt', data: 'x' })
    expect(await files.pick()).toBeNull()
  })

  it('prefers a registered platform driver', async () => {
    const app = createApp({ environment: 'client', providers: [filesProvider] })
    const native = createMemoryFilesDriver()
    native.name = 'native'
    app.drivers.register('files', native)
    await app.boot()
    expect(app.container.use('files').driver.name).toBe('native')
  })
})
