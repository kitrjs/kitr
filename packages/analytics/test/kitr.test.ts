import { describe, expect, it } from 'vitest'
import analytics from '../src/kitr'

/** A recording stand-in for the codemod context; `packages` are the ones already in kitrrc.ts. */
async function run(packages: string[] = []) {
  const writes: Record<string, string> = {}
  const configs: Record<string, string> = {}
  const env: string[] = []
  const ctx = {
    hasPackage: (name: string) => packages.includes(name),
    write: (file: string, src: string) => {
      writes[file] = src
    },
    config: (name: string, src: string) => {
      configs[name] = src
    },
    provider: { add() {} },
    env: { schema: (_scope: string, name: string) => env.push(name) },
    agents: { add() {} },
  }
  await analytics.add!(ctx as any)
  return { writes, configs, env }
}

describe('kitr add analytics', () => {
  it('templates Plausible first, Google Analytics second, both from optional env', async () => {
    const { configs, env } = await run()
    const config = configs.analytics!
    expect(config.indexOf('plausible({')).toBeGreaterThan(-1)
    expect(config.indexOf('plausible({')).toBeLessThan(config.indexOf('googleAnalytics({'))
    expect(env).toEqual(['VITE_PLAUSIBLE_DOMAIN', 'VITE_PLAUSIBLE_HOST', 'VITE_GA_MEASUREMENT_ID'])
    expect(config).toContain('// enabled: false,')
  })

  it('says analytics waits for consent when the consent package is installed', async () => {
    const { configs } = await run(['consent'])
    expect(configs.analytics).toContain('// Held until the visitor accepts: see config/consent.ts')
    expect(configs.analytics).not.toContain('enabled: false')
  })

  it('writes an empty event map, with the demo events only as a comment', async () => {
    const { writes } = await run()
    const events = writes['app/analytics.ts']!
    expect(events).toContain('export interface AppEvents extends EventMap {')
    expect(events).toContain("  // 'project.created': { id: string }")
    expect(events).not.toMatch(/^\s+'project\.created'/m)
  })
})
