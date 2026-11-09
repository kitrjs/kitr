import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { validateManifest } from '../src/manifest'
import { kitManifests, manifests } from '../src/manifests.gen'
import { platformTypeNames } from '../src/platforms'
import { cleanup, scratch, write } from './helpers'

afterAll(cleanup)

/** A platform block that passes, for tests to break one field at a time. */
const platformBlock = () => ({
  label: 'Kiosk',
  tagline: 'Fullscreen Chromium on a Raspberry Pi.',
  targets: ['Raspberry Pi'],
  shell: 'Chromium',
  color: '#2D6CF0',
  highlights: [{ title: 'Boots into the app', text: 'The Pi opens the app on start.' }],
  snippet: '// kitrrc.ts\nplatforms: { lobby: kiosk() },',
  run: [['kitr dev lobby', 'Chromium over Vite']],
  resources: [{ title: 'Chromium', url: 'https://www.chromium.org', text: 'The browser.' }],
})
const kiosk = (platform: unknown, kind = 'platform') => ({
  name: 'kiosk',
  title: 'Kiosk',
  summary: 'Run the app fullscreen on a Raspberry Pi.',
  category: 'platforms',
  runsOn: 'client',
  kind,
  platform,
})

const root = join(import.meta.dirname, '../..')
const packages = readdirSync(root)
  .map((dir) => ({ dir, file: join(root, dir, 'package.json') }))
  .filter(({ file }) => existsSync(file))
  .map(({ dir, file }) => ({ dir, pkg: JSON.parse(readFileSync(file, 'utf8')) }))
  .filter(({ pkg }) => pkg.kitr)

describe('package manifests', () => {
  const names = packages.map(({ pkg }) => pkg.kitr.name)

  it.each(packages.map(({ dir, pkg }) => [dir, pkg]))('%s has a valid kitr block', (dir, pkg) => {
    expect(validateManifest(pkg.kitr, names)).toEqual([])
    expect(pkg.kitr.kind === 'kit' ? `kit-${pkg.kitr.name}` : pkg.kitr.name).toBe(dir)
    expect(pkg.keywords).toContain('kitr-package')
  })

  it('the generated copy matches every package.json', () => {
    for (const { pkg } of packages)
      expect((pkg.kitr.kind === 'kit' ? kitManifests : manifests)[pkg.kitr.name]).toEqual({
        package: pkg.name,
        ...pkg.kitr,
        ...(pkg.private ? { preview: true } : {}),
      })
    expect([...Object.keys(manifests), ...Object.keys(kitManifests)].sort()).toEqual(
      [...names].sort(),
    )
  })

  it('every package ships a setup module, and platforms say so', () => {
    for (const { dir, pkg } of packages) {
      if (pkg.kitr.included) continue
      expect(pkg.kitr.setup, dir).toBe('./kitr')
      expect(pkg.exports['./kitr'], dir).toBeDefined()
    }
    expect([...platformTypeNames].sort()).toEqual(['desktop', 'mobile', 'server', 'tauri', 'web'])
  })

  // The CLI plans from the setup module, so it must say what the manifest says.
  it.each(
    packages
      .filter(({ dir, pkg }) => !pkg.kitr.included && existsSync(join(root, dir, 'src/kitr.ts')))
      .map(({ dir, pkg }) => [dir, pkg]),
  )('%s setup module declares the manifest requires and client', async (dir, pkg) => {
    const definition = (await import(join(root, dir, 'src/kitr.ts'))).default
    expect([...(definition.requires ?? [])].sort()).toEqual([...(pkg.kitr.requires ?? [])].sort())
    expect(Boolean(definition.client)).toBe(Boolean(pkg.kitr.client))
  })

  it('rejects a bad manifest', () => {
    expect(
      validateManifest(
        {
          name: 'x',
          title: 'X',
          summary: 's',
          category: 'nope',
          runsOn: 'edge',
          requires: ['missing'],
        },
        ['x'],
      ),
    ).toEqual([
      expect.stringContaining('"category"'),
      expect.stringContaining('"runsOn"'),
      'requires unknown package "missing"',
    ])
  })
})

describe('the platform block', () => {
  it('every platform package describes itself', () => {
    const platforms = packages.filter(({ pkg }) => pkg.kitr.kind === 'platform')
    expect(platforms.map(({ pkg }) => pkg.kitr.name).sort()).toEqual([...platformTypeNames].sort())
    for (const { dir, pkg } of platforms) {
      expect(pkg.kitr.platform, dir).toBeDefined()
      expect(pkg.kitr.platform.highlights.length, dir).toBeGreaterThanOrEqual(3)
      expect(pkg.kitr.platform.snippet, dir).toMatch(/^\/\/ [\w./-]+\n/)
    }
  })

  it('accepts a complete block', () => {
    expect(validateManifest(kiosk(platformBlock()))).toEqual([])
  })

  it('names each broken field', () => {
    const block = {
      ...platformBlock(),
      label: '',
      color: 'blue',
      targets: [],
      highlights: [{ title: 'No text' }],
      run: [['kitr dev lobby']],
      resources: [{ title: 'Chromium', url: 'http://www.chromium.org', text: 'The browser.' }],
    }
    expect(validateManifest(kiosk(block))).toEqual([
      '"platform": "label" must be a non-empty string',
      '"platform": "color" must be a hex colour such as "#38BDF8"',
      '"platform": "targets" must be a non-empty list of strings',
      '"platform": "highlights[0]" must be { title, text }',
      '"platform": "run[0]" must be [command, what]',
      '"platform": "resources[0]" must be { title, url, text } with an https:// url',
    ])
  })

  it('belongs to platform packages only, and its alternative must exist', () => {
    expect(validateManifest(kiosk(platformBlock(), 'package'))).toEqual([
      '"platform" is only for packages with kind "platform"',
    ])
    expect(validateManifest(kiosk('Chromium'))).toEqual(['"platform": must be an object'])
    expect(
      validateManifest(kiosk({ ...platformBlock(), alternative: 'signage' }), ['kiosk', 'web']),
    ).toEqual(['"platform": "alternative" names unknown package "signage"'])
  })
})

describe('kitr package:check', () => {
  it('reports a broken platform block', async () => {
    const { checkPackage } = await import('../src/commands/package-check')
    const dir = scratch()
    write(
      dir,
      'package.json',
      JSON.stringify({
        name: '@acme/kitr-kiosk',
        keywords: ['kitr-package'],
        kitr: kiosk({ ...platformBlock(), color: 'blue' }),
      }),
    )
    expect(checkPackage(dir)).toContain(
      'kitr block: "platform": "color" must be a hex colour such as "#38BDF8"',
    )
  })

  it('passes for every package with docs', async () => {
    const { checkPackage } = await import('../src/commands/package-check')
    for (const { dir, pkg } of packages)
      if (existsSync(join(root, dir, pkg.kitr.docs ?? 'docs', 'index.md')))
        expect(checkPackage(join(root, dir)), dir).toEqual([])
  })
})
