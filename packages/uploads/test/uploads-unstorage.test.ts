import { createStorage } from 'unstorage'
import { describe, expect, it } from 'vitest'
import { createUnstorageUploadsDriver, createUploads } from '../src/server'

describe('unstorage uploads driver', () => {
  it('lets one instance read what another stored', async () => {
    // One bucket, two server instances: what Ada uploads through A, Grace downloads through B.
    const bucket = createStorage()
    const a = createUploads({ driver: createUnstorageUploadsDriver(bucket) })
    const b = createUploads({ driver: createUnstorageUploadsDriver(bucket) })
    const bytes = new TextEncoder().encode('%PDF-1.7 invoice')
    const stored = await a.store({ name: 'invoice.pdf', type: 'application/pdf', data: bytes })
    const read = await b.read(stored.key)
    expect(read?.type).toBe('application/pdf')
    expect(new TextDecoder().decode(read?.data)).toBe('%PDF-1.7 invoice')
    await b.remove(stored.key)
    expect(await a.read(stored.key)).toBeUndefined()
  })

  it('builds URLs from publicPath and refuses keys that climb out', async () => {
    const driver = createUnstorageUploadsDriver(createStorage(), { publicPath: '/api/uploads/' })
    expect(driver.url?.('abc/report.pdf')).toBe('/api/uploads/abc/report.pdf')
    await expect(driver.get('../secrets')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
