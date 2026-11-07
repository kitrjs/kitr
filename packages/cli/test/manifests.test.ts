import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateManifest } from '../src/manifest'
import { kitManifests, manifests } from '../src/manifests.gen'
import { platformTypeNames } from '../src/platforms'

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

describe('kitr package:check', () => {
  it('passes for every package with docs', async () => {
    const { checkPackage } = await import('../src/commands/package-check')
    for (const { dir, pkg } of packages)
      if (existsSync(join(root, dir, pkg.kitr.docs ?? 'docs', 'index.md')))
        expect(checkPackage(join(root, dir)), dir).toEqual([])
  })
})
