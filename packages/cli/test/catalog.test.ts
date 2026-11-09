import { afterAll, describe, expect, it } from 'vitest'
import type { KitrCatalog } from '../src'
import { cleanup, kitr, scratch } from './helpers'

afterAll(cleanup)

describe('kitr catalog', () => {
  it('--json prints the packages, kits and the five platforms with their highlights', async () => {
    const run = await kitr(scratch(), 'catalog', '--json')
    expect(run.code).toBeUndefined()
    const catalog = JSON.parse(run.out) as KitrCatalog
    expect(catalog.platforms.map((p) => p.name)).toEqual([
      'desktop',
      'mobile',
      'server',
      'tauri',
      'web',
    ])
    for (const p of catalog.platforms) {
      expect(p.package).toBe(`@kitr/${p.name}`)
      expect(p.platform?.highlights.length, p.name).toBeGreaterThanOrEqual(3)
      expect(p.platform?.highlights[0]).toEqual({
        title: expect.any(String),
        text: expect.any(String),
      })
    }
    const web = catalog.platforms.find((p) => p.name === 'web')
    expect(web?.platform).toMatchObject({
      label: 'SSR · SPA · PWA',
      targets: ['Static', 'SPA', 'SSR', 'PWA'],
      highlights: expect.arrayContaining([
        expect.objectContaining({ title: 'Three rendering modes, one option' }),
      ]),
    })
    expect(catalog.packages.map((p) => p.name)).toContain('jobs')
    expect(catalog.packages.some((p) => p.kind === 'platform')).toBe(false)
    expect(catalog.kits.map((k) => k.name)).toContain('app')
  })

  it('without --json lists names and summaries by group', async () => {
    const run = await kitr(scratch(), 'catalog')
    expect(run.out).toMatch(/Platforms \(kitr add <type> <name>\)/)
    expect(run.out).toMatch(/\n {2}tauri\s+Ship the same app to Windows/)
    expect(run.out).toMatch(/Kits \(kitr new <dir> --kit <name>\)/)
  })
})
