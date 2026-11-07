import { describe, expect, it } from 'vitest'
import { outsidePrefix, syncPlan } from '../src/commands'

const project = { name: 'acme', version: '1.2.3', hasAppApi: true }

// Regression: `kitr api:sync` read config/api.ts with regexes that took the first `path:` in the
// file, ignored `openapi.description` and `client.path`, and nothing read `prefix`.
describe('kitr api:sync config', () => {
  it('defaults from package.json and the project layout', () => {
    expect(syncPlan({}, project)).toEqual({
      out: 'openapi.json',
      tablePath: 'app/api/routes.gen.ts',
      info: { title: 'acme API', version: '1.2.3' },
    })
    expect(syncPlan({}, { ...project, hasAppApi: false }).tablePath).toBe('server/routes.gen.ts')
  })

  it('reads openapi.path, title, version and description, and client.path', () => {
    const plan = syncPlan(
      {
        client: { path: 'src/http/client.ts' },
        openapi: { path: 'docs/openapi.json', title: 'Acme', version: '2', description: 'The API' },
      },
      project,
    )
    expect(plan).toEqual({
      out: 'docs/openapi.json',
      tablePath: 'src/http/routes.gen.ts',
      info: { title: 'Acme', version: '2', description: 'The API' },
    })
    // client.path declared before openapi.path no longer steals the OpenAPI output path.
    expect(syncPlan({ client: { path: 'app/api/client.ts' } }, project).out).toBe('openapi.json')
    expect(syncPlan({ openapi: { path: 'a.json' } }, project, 'b.json').out).toBe('b.json')
  })

  it('finds routes outside the prefix', () => {
    const routes = [{ path: '/api/health' }, { path: '/api' }, { path: '/apix' }, { path: '/me' }]
    expect(outsidePrefix(routes, '/api')).toEqual(['/apix', '/me'])
    expect(outsidePrefix(routes, '/api/')).toEqual(['/apix', '/me'])
    expect(outsidePrefix(routes, undefined)).toEqual([])
  })
})
