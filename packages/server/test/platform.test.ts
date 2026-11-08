import { describe, expect, it } from 'vitest'
import { fakePlatformContext } from '../../../tests/setup/platform-context'
import { server } from '../src/platform'

const rc = (packages: string[]) =>
  `export default defineKitrConfig({ packages: [${packages.map((p) => `'${p}'`).join(', ')}] })`

describe('server()', () => {
  it('fills defaults and validates runtime and port', () => {
    expect(server().options).toEqual({
      runtime: 'node',
      port: 3001,
      host: undefined,
      entry: 'server/main.ts',
    })
    expect(() => server({ runtime: 'jvm' as any })).toThrow(
      /runtime must be one of node, bun, deno, workers/,
    )
    expect(() => server({ port: -1 })).toThrow(/port/)
  })

  it('needs tsx only on node and wrangler only on workers', () => {
    const names = (r: any) => server({ runtime: r }).dependencies!.map((d) => d.name)
    expect(names('node')).toEqual(['h3', 'srvx', 'tsx'])
    expect(names('bun')).toEqual(['h3', 'srvx'])
    expect(names('workers')).toEqual(['h3', 'srvx', 'wrangler'])
  })

  it.each([
    ['node', 'exec', 'tsx', ['watch', 'server/main.ts']],
    ['bun', 'run', 'bun', ['--watch', 'server/main.ts']],
    ['deno', 'run', 'deno', ['run', '--watch', '-A', 'server/main.ts']],
    ['workers', 'exec', 'wrangler', ['dev', '--port', '3001']],
  ] as const)('dev on %s runs %s %s', async (runtime, kind, command, args) => {
    const api = server({ runtime })
    const f = fakePlatformContext(api, { name: 'api' })
    await api.dev!(f.ctx)
    expect(f.calls).toHaveLength(1)
    expect(f.calls[0]).toMatchObject({ kind, command, args })
    if (runtime === 'workers') expect(f.calls[0]!.cwd).toBe('/project/platforms/api')
    else expect(f.calls[0]!.env).toEqual({ PORT: '3001', HOST: 'localhost' })
  })

  it('dev and start take --port and --host over the options', async () => {
    const api = server({ port: 3001, host: '10.0.0.1' })
    const dev = fakePlatformContext(api, { flags: { port: 9000 } })
    await api.dev!(dev.ctx)
    expect(dev.calls[0]!.env).toEqual({ PORT: '9000', HOST: '10.0.0.1' })
    const start = fakePlatformContext(api, { flags: { port: 9001, host: '127.0.0.1' } })
    await api.start!(start.ctx)
    expect(start.calls[0]).toMatchObject({
      kind: 'run',
      command: 'node',
      args: ['--import', 'tsx', 'server/main.ts'],
      env: { PORT: '9001', HOST: '127.0.0.1' },
    })
  })

  it('start binds every interface by default in production', async () => {
    const api = server()
    const f = fakePlatformContext(api)
    await api.start!(f.ctx)
    expect(f.calls[0]!.env).toEqual({ PORT: '3001', HOST: '0.0.0.0' })
  })

  it('build typechecks on node and bundles on workers', async () => {
    const node = fakePlatformContext(server())
    await server().build!(node.ctx)
    expect(node.calls.map((c) => [c.command, ...c.args])).toEqual([
      ['tsc', '--noEmit', '-p', 'tsconfig.json'],
    ])
    const workers = server({ runtime: 'workers' })
    const w = fakePlatformContext(workers, { name: 'edge' })
    await workers.build!(w.ctx)
    expect(w.calls[0]).toMatchObject({
      command: 'wrangler',
      args: ['deploy', '--dry-run', '--outdir', '/project/dist/edge'],
      cwd: '/project/platforms/edge',
    })
  })

  describe('scaffold', () => {
    it('writes a server-only entry that reads providers from kitrrc.ts', () => {
      const api = server({ port: 4000 })
      const f = fakePlatformContext(api, {
        files: { 'package.json': '{"name":"svc"}', 'kitrrc.ts': rc(['@kitr/server', '@kitr/api']) },
      })
      api.scaffold!(f.ctx)
      const entry = f.files.get('server/main.ts')!
      expect(entry).toContain("import rc from '../kitrrc'")
      expect(entry).toContain("import { routes } from './routes'")
      expect(entry).toContain('createServer({ ...loadRc(rc, config), routes })')
      expect(entry).toContain('Number(process.env.PORT) || 4000')
      expect(entry).not.toMatch(/react/i)
      // An empty table: `kitr add api` / `kitr add realtime` extend it with their methods.
      expect(f.files.get('server/routes.ts')).toContain('defineRoutes([], (r) => r)')
      expect(f.files.get('server/routes.ts')).toContain('export type ServerRoutes')
      expect(f.files.has('app/server.ts')).toBe(false)
    })

    it("in a React app with a web platform, writes Start's server entry that asks the kitr server first", () => {
      const api = server()
      const f = fakePlatformContext(api, {
        files: {
          'package.json': JSON.stringify({ name: 'shop', dependencies: { react: '19' } }),
          'kitrrc.ts': rc(['@kitr/react', '@kitr/server']),
          'app/routes/__root.tsx': '',
        },
        platforms: [api, { type: 'web' } as any],
      })
      api.scaffold!(f.ctx)
      expect(f.files.get('server/main.ts')).toContain("import { config } from '../config'")
      expect(f.files.get('server/main.ts')).toContain("import { routes } from '#server/routes'")
      expect(f.files.get('server/main.ts')).toContain("import { loadRc } from '@kitr/kitr/app'")
      expect(f.files.get('server/main.ts')).toContain(
        'createServer({ ...loadRc(rc, config), routes })',
      )
      const entry = f.files.get('app/server.ts')!
      expect(entry).toContain("from '@tanstack/react-start/server-entry'")
      expect(entry).toContain('return server.fetch(request, {')
      expect(entry).toContain('pages: (request) => {')
      expect(entry).toContain('return handler.fetch(request, options)')
    })

    it('leaves sockets to the route table: the entry never changes shape for realtime', () => {
      const api = server()
      const f = fakePlatformContext(api, {
        files: {
          'package.json': '{"name":"svc"}',
          'kitrrc.ts': rc(['@kitr/server', '@kitr/realtime']),
          'config/realtime.ts': "export default { path: '/live' }",
        },
      })
      api.scaffold!(f.ctx)
      expect(f.files.get('server/main.ts')).not.toMatch(/realtime|attach/)
      expect(f.files.get('server/main.ts')).toContain("import { loadRc } from '@kitr/kitr/app'")
      expect(f.files.get('server/main.ts')).toContain(
        'createServer({ ...loadRc(rc, config), routes })',
      )
    })

    it('writes wrangler.toml for workers, named after the package', () => {
      const edge = server({ runtime: 'workers' })
      const f = fakePlatformContext(edge, {
        name: 'edge',
        files: { 'package.json': '{"name":"@acme/My App"}', 'kitrrc.ts': rc([]) },
      })
      edge.scaffold!(f.ctx)
      const toml = f.files.get('platforms/edge/wrangler.toml')!
      expect(toml).toContain('name = "my-app-edge"')
      expect(toml).toContain('main = "../../server/main.ts"')
    })

    it('never overwrites an existing entry or routes file', () => {
      const api = server()
      const f = fakePlatformContext(api, {
        files: {
          'package.json': '{}',
          'kitrrc.ts': rc(['@kitr/api']),
          'server/main.ts': 'mine',
          'server/routes.ts': 'mine too',
        },
      })
      api.scaffold!(f.ctx)
      expect(f.files.get('server/main.ts')).toBe('mine')
      expect(f.files.get('server/routes.ts')).toBe('mine too')
    })
  })

  it('doctor reports the missing entry and dependencies for the runtime', () => {
    const api = server({ runtime: 'workers' })
    const f = fakePlatformContext(api, { name: 'edge', files: { 'package.json': '{}' } })
    expect((api.doctor!(f.ctx) as any[]).map((x) => x.message)).toEqual([
      'edge: server/main.ts is missing',
      'edge: h3 is not installed',
      'edge: srvx is not installed',
      'edge: wrangler is not installed',
    ])
    const ok = fakePlatformContext(server(), {
      files: {
        'package.json': JSON.stringify({
          dependencies: { h3: '2', srvx: '0' },
          devDependencies: { tsx: '4' },
        }),
        'server/main.ts': '',
      },
    })
    expect(server().doctor!(ok.ctx)).toEqual([])
  })
})
