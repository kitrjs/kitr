import type { AddContext } from '@kitr/core/package'
import { describe, expect, it } from 'vitest'
import setup from '../src/kitr'

/** A recording stand-in for the `AddContext` that `kitr add` passes: every call is a no-op except the ones read here. */
function fakeContext(
  project: { platforms?: Record<string, { factory: string }>; deps?: string[] } = {},
) {
  const installed: string[] = []
  const noop = () => {}
  const ctx = {
    rc: { platforms: project.platforms ?? {} },
    has: (name: string) => (project.deps ?? []).includes(name),
    deps: { add: (...names: string[]) => installed.push(...names), remove: noop },
    provider: { add: noop, remove: noop },
    config: noop,
    write: noop,
    agents: { add: noop, remove: noop },
  }
  return { ctx: ctx as unknown as AddContext, installed }
}

describe('notifications setup', () => {
  it('adds no Capacitor plugins to a web-only project', () => {
    const { ctx, installed } = fakeContext({ platforms: { site: { factory: 'web' } } })
    setup.add?.(ctx)
    expect(installed).toEqual([])
  })

  it('adds the plugins its Capacitor driver needs when the project has the mobile platform', () => {
    const { ctx, installed } = fakeContext({ platforms: { phone: { factory: 'mobile' } } })
    setup.add?.(ctx)
    expect(installed).toEqual(['@capacitor/local-notifications', '@capacitor/push-notifications'])
  })

  it('adds them when Capacitor is already installed', () => {
    const { ctx, installed } = fakeContext({ deps: ['@capacitor/core'] })
    setup.add?.(ctx)
    expect(installed).toEqual(['@capacitor/local-notifications', '@capacitor/push-notifications'])
  })

  it('removes without touching dependencies', () => {
    const { ctx, installed } = fakeContext({ platforms: { phone: { factory: 'mobile' } } })
    setup.remove?.(ctx)
    expect(installed).toEqual([])
  })
})
