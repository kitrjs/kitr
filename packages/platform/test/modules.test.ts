import { describe, expect, it, vi } from 'vitest'
import { loadShellModule, registerShellModules } from '../src'

describe('shell modules', () => {
  it('loads a module through the loader a shell registered', async () => {
    const mod = { hello: 'world' }
    const load = vi.fn(async () => mod)
    registerShellModules({ '@acme/plugin': load })
    expect(await loadShellModule('@acme/plugin')).toBe(mod)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('a later registration replaces an earlier one', async () => {
    registerShellModules({ '@acme/swap': async () => 1 })
    registerShellModules({ '@acme/swap': async () => 2 })
    expect(await loadShellModule('@acme/swap')).toBe(2)
  })

  it('rejects with the loader error when the registered module fails to load', async () => {
    registerShellModules({
      '@acme/broken': async () => {
        throw new Error('not installed')
      },
    })
    await expect(loadShellModule('@acme/broken')).rejects.toThrow('not installed')
  })

  it('falls back to a plain import for an unregistered module', async () => {
    expect(await loadShellModule<typeof import('node:path')>('node:path')).toHaveProperty('join')
    await expect(loadShellModule('@acme/never-registered-or-installed')).rejects.toThrow()
  })

  it('shares one registry across copies of the package', async () => {
    registerShellModules({ '@acme/shared': async () => 'x' })
    const key = Symbol.for('kitr.shellModules')
    const registry = (globalThis as unknown as Record<symbol, Map<string, unknown>>)[key]
    expect(registry?.has('@acme/shared')).toBe(true)
  })
})
