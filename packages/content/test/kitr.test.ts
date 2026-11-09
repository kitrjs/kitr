import { describe, expect, it, vi } from 'vitest'
import content, { contentConfig } from '../src/kitr'

describe('content setup module', () => {
  it('writes config/content.ts, a first page and its AGENTS.md section', async () => {
    const ctx = {
      types: { enable: vi.fn() },
      config: vi.fn(),
      write: vi.fn(),
      agents: { add: vi.fn(), remove: vi.fn() },
    }
    await content.add!(ctx as any)
    expect(ctx.types.enable).toHaveBeenCalled()
    expect(ctx.config).toHaveBeenCalledWith('content', contentConfig)
    expect(contentConfig).toContain(
      "docs: { source: 'content/docs', url: '/docs', nav: 'nav.json' }",
    )
    expect(contentConfig).toContain('llms: true')
    expect(ctx.write.mock.calls.map((c) => c[0])).toEqual([
      'content/docs/nav.json',
      'content/docs/getting-started.md',
    ])
    expect(JSON.parse(ctx.write.mock.calls[0]![1])).toEqual([
      { title: 'Start here', pages: ['getting-started'] },
    ])
    expect(ctx.agents.add.mock.calls[0]![0]).toBe('content')
    expect(ctx.agents.add.mock.calls[0]![1]).toContain('kitr generate')
    await content.remove!(ctx as any)
    expect(ctx.agents.remove).toHaveBeenCalledWith('content')
  })

  it('declares its generator, Vite plugin and server-only config', async () => {
    expect(content.vite).toEqual({ plugin: '@kitr/content/vite', serverOnlyConfig: true })
    const mod = (await content.types!()) as { default: { name: string } }
    expect(mod.default.name).toBe('content')
    expect(content.client).toBe(true)
  })
})
