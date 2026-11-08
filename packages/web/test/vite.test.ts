import { describe, expect, it } from 'vitest'
import { web } from '../src'
import kitrPwa, { kitrPwa as named } from '../src/vite'

describe('kitrPwa', () => {
  it('is the default and the named export', () => {
    expect(kitrPwa).toBe(named)
  })

  it('builds vite-plugin-pwa from the platform options', async () => {
    const plugins = await kitrPwa(
      web({ pwa: { name: 'Shop', themeColor: '#123456' } }).options,
      'app',
    )
    expect(plugins.map((p) => p.name)).toContain('vite-plugin-pwa')
  })

  it('does not generate a worker while the ssr environment is resolved', async () => {
    const plugins = await kitrPwa(web({ pwa: true }).options, 'app')
    let wrapped = 0
    for (const plugin of plugins) {
      const hook = plugin.configResolved
      if (!hook) continue
      const handler = typeof hook === 'function' ? hook : hook.handler
      // The real hook would throw on this fake config; the wrapper returns before reaching it.
      await expect(
        (handler as (this: unknown, config: unknown) => unknown).call({}, { build: { ssr: true } }),
      ).resolves.toBeUndefined()
      wrapped++
    }
    expect(wrapped).toBeGreaterThan(0)
  })

  it('accepts autoUpdate, dev enabling and raw plugin options', async () => {
    const plugins = await kitrPwa(
      web({
        pwa: { registerType: 'autoUpdate', devEnabled: true, plugin: { injectRegister: 'auto' } },
      }).options,
      'app',
    )
    expect(plugins.length).toBeGreaterThan(0)
  })
})
