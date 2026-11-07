import { createApp } from '@kitr/core'
import { describe, expect, it } from 'vitest'
import {
  createFlags,
  defineFlags,
  envFlagsProvider,
  openFeatureFlagsProvider,
  percentageFlagsProvider,
  staticFlagsProvider,
} from '../src'
import flagsProvider from '../src/provider'
import { flagsScript, resolveFlags } from '../src/server'

const flags = defineFlags({
  newDashboard: { default: false, description: 'The redesigned overview' },
  pageSize: { default: 20 },
  theme: { default: 'classic' },
})

describe('flags', () => {
  it('answers defaults before resolve, then the first provider with an opinion', async () => {
    const f = createFlags(flags, {
      providers: [
        staticFlagsProvider({ theme: 'fresh' }),
        envFlagsProvider({ FLAG_NEW_DASHBOARD: 'true', FLAG_PAGE_SIZE: '50', FLAG_THEME: 'env' }),
      ],
    })
    expect(f.value('newDashboard')).toBe(false)
    expect(f.resolved).toBe(false)
    const values = await f.resolve({ userId: 'u1' })
    expect(values).toEqual({ newDashboard: true, pageSize: 50, theme: 'fresh' })
    expect(f.isEnabled('newDashboard')).toBe(true)
    expect(f.resolved).toBe(true)
  })

  it('hydrates a snapshot and notifies subscribers', () => {
    const f = createFlags(flags)
    let calls = 0
    const off = f.subscribe(() => calls++)
    f.hydrate({ newDashboard: true })
    expect(f.snapshot()).toEqual({ newDashboard: true, pageSize: 20, theme: 'classic' })
    off()
    f.hydrate({})
    expect(calls).toBe(1)
  })

  it('targets a share of users deterministically', async () => {
    const p = percentageFlagsProvider({ newDashboard: 50 })
    const a = await p.resolve('newDashboard', { userId: 'alice' })
    expect(await p.resolve('newDashboard', { userId: 'alice' })).toBe(a)
    expect(await p.resolve('newDashboard', {})).toBe(false)
    expect(await p.resolve('pageSize', { userId: 'alice' })).toBeUndefined()
    const on = [
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
      'k',
      'l',
      'm',
      'n',
      'o',
      'p',
    ].filter((id) => percentageFlagsProvider({ x: 50 }).resolve('x', { userId: id }) as boolean)
    expect(on.length).toBeGreaterThan(2)
    expect(on.length).toBeLessThan(14)
  })

  it('adapts an OpenFeature client by the declared type', async () => {
    const client = {
      getBooleanValue: async (k: string) => k === 'newDashboard',
      getStringValue: async () => 'of',
      getNumberValue: async () => 7,
    }
    const f = createFlags(flags, { providers: [openFeatureFlagsProvider(client, flags)] })
    expect(await f.resolve()).toEqual({ newDashboard: true, pageSize: 7, theme: 'of' })
  })

  it('resolves once per request on the server and embeds a script', async () => {
    const app = createApp({
      environment: 'server',
      providers: [flagsProvider],
      config: {
        flags: {
          definitions: flags,
          providers: [staticFlagsProvider((ctx) => ({ newDashboard: ctx.userId === 'u1' }))],
        },
      },
    })
    await app.boot()
    const event = { context: { kitr: { locals: { user: { id: 'u1' } } } } }
    const first = await resolveFlags<typeof flags>(app, event)
    expect(first.newDashboard).toBe(true)
    expect(await resolveFlags(app, event)).toBe(first)
    expect(flagsScript(first)).toBe(
      '<script type="application/json" id="__kitr_flags__">{"newDashboard":true,"pageSize":20,"theme":"classic"}</script>',
    )
  })

  it('resolves at boot in the browser', async () => {
    const app = createApp({
      environment: 'client',
      providers: [flagsProvider],
      config: {
        flags: { definitions: flags, providers: [staticFlagsProvider({ theme: 'client' })] },
      },
    })
    await app.boot()
    expect(app.container.use('flags').value('theme')).toBe('client')
  })
})
