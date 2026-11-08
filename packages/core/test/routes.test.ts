import { describe, expect, it } from 'vitest'
import {
  type AnyRouteTable,
  createRouteTable,
  defineRouteExtension,
  defineRoutes,
  isRouteTable,
  joinPath,
  KitrError,
  type RouteEntry,
} from '../src'

/** A tiny extension for the tests: `.hit(path)` registers a `hit` entry, compiled by the `list` target. */
const hits = defineRouteExtension({
  key: 'hits' as never,
  kinds: ['hit'],
  methods: {
    hit(this: AnyRouteTable, path: string, options: { name?: string } = {}) {
      const fullPath = joinPath(this.prefix, path)
      this.add({
        kind: 'hit',
        path: fullPath,
        name: options.name ? `${this.namePrefix}${options.name}` : `HIT ${fullPath}`,
      })
      return this
    },
  },
  group(child, _parent, prefix) {
    child.state.hits = { seen: prefix }
  },
  targets: {
    list: (entries: RouteEntry[], prefix: string) => entries.map((e) => `${prefix}${e.path}`),
  },
})

const marks = defineRouteExtension({
  key: 'marks' as never,
  kinds: ['mark'],
  methods: {
    mark(this: AnyRouteTable, name: string) {
      this.add({ kind: 'mark', path: joinPath(this.prefix, '/'), name, scope: 'absolute' })
      return this
    },
  },
  targets: {
    list: (entries: RouteEntry[]) => entries.length,
  },
})

type Any = any

describe('route table', () => {
  it('installs only the methods of the given extensions', () => {
    const table = createRouteTable([hits]) as Any
    expect(typeof table.hit).toBe('function')
    expect(table.mark).toBeUndefined()
    expect(isRouteTable(table)).toBe(true)
    expect(isRouteTable({})).toBe(false)
    expect(() => defineRoutes([hits, hits])).toThrow(/listed twice/)
  })

  it('prefixes paths and names through nested groups, in registration order', () => {
    const routes = defineRoutes([hits], (r: Any) =>
      r
        .hit('/health', { name: 'health' })
        .group('/api', (api: Any) =>
          api
            .hit('/projects')
            .group({ prefix: '/admin', as: 'admin' }, (admin: Any) =>
              admin.hit('/users', { name: 'users' }),
            ),
        )
        .group({ prefix: '/v2', as: 'v2' }, (v2: Any) => v2.hit('/')),
    )
    expect(routes.toJSON()).toEqual([
      { kind: 'hit', path: '/health', name: 'health' },
      { kind: 'hit', path: '/api/projects', name: 'HIT /api/projects' },
      { kind: 'hit', path: '/api/admin/users', name: 'admin.users' },
      { kind: 'hit', path: '/v2', name: 'HIT /v2' },
    ])
    expect(routes.url('admin.users')).toBe('/api/admin/users')
  })

  it('collects middleware from use() and group options, outermost first', () => {
    const a = () => {}
    const b = () => {}
    const c = () => {}
    const routes = defineRoutes([hits], (r: Any) =>
      r.use(a).group({ prefix: '/x', middleware: [b] }, (x: Any) => x.use(c).hit('/y').hit('/z')),
    )
    expect(routes.entries.map((e) => e.middleware)).toEqual([
      [a, b, c],
      [a, b, c],
    ])
  })

  it('lets extensions keep state per table and hook into groups', () => {
    let inner: AnyRouteTable | undefined
    defineRoutes([hits], (r: Any) => r.group('/admin', (g: Any) => (inner = g)))
    expect(inner?.state.hits).toEqual({ seen: '/admin' })
  })

  it('merges another table and throws a KitrError naming a duplicate route', () => {
    const server = defineRoutes([hits], (r: Any) => r.hit('/api/a').hit('/api/b'))
    const app = defineRoutes([marks], (r: Any) => r.mark('home')).merge(server)
    expect(app.entries.map((e) => e.name)).toEqual(['home', 'HIT /api/a', 'HIT /api/b'])
    expect(() => app.merge(server)).toThrow(KitrError)
    expect(() => app.merge(server)).toThrow('"HIT /api/a"')
    // A failed merge adds nothing.
    expect(app.entries).toHaveLength(3)
    const clash = defineRoutes([hits], (r: Any) => r.hit('/api/c').hit('/api/b'))
    expect(() => app.merge(clash)).toThrow('"HIT /api/b"')
    expect(app.entries).toHaveLength(3)
  })

  it('applies use() to later entries and to groups opened after it', () => {
    const routes = defineRoutes([hits], (r: Any) =>
      r
        .hit('/before')
        .use('auth')
        .hit('/after')
        .group('/g', (g: Any) => g.hit('/in')),
    )
    expect(routes.entries.map((e) => [e.name, e.middleware])).toEqual([
      ['HIT /before', []],
      ['HIT /after', ['auth']],
      ['HIT /g/in', ['auth']],
    ])
  })

  it('compiles each extension with its own kinds and returns the results by key', () => {
    const routes = defineRoutes([hits, marks], (r: Any) =>
      r
        .hit('/a')
        .mark('m')
        .group('/g', (g: Any) => g.hit('/b').mark('n')),
    )
    expect(routes.compile('list', 'http://x')).toEqual({
      hits: ['http://x/a', 'http://x/g/b'],
      marks: 2,
    })
    expect(routes.compile('nothing', null)).toEqual({})
  })

  it('builds urls with params and query', () => {
    const routes = defineRoutes([hits], (r: Any) =>
      r.hit('/projects/:id/tasks/:taskId', { name: 'task' }),
    )
    expect(routes.url('task', { id: '1', taskId: 2 }, { tab: 'files', open: true })).toBe(
      '/projects/1/tasks/2?tab=files&open=true',
    )
    expect(() => routes.url('nope' as never)).toThrow(/No route named/)
  })

  it('joins paths without doubled or trailing slashes', () => {
    expect(joinPath('', '')).toBe('/')
    expect(joinPath('/api/', '/projects/')).toBe('/api/projects')
    expect(joinPath('api', 'x')).toBe('/api/x')
  })
})
