import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  controllerCandidates,
  flattenPages,
  joinPath,
  moduleCandidates,
  normalize,
  parsePageRoutes,
} from '../src/routes'

// app/routes.ts of the examples, copied as they are.
const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8')

/** The tree without line numbers, for compact assertions. */
const shape = (entries: ReturnType<typeof parsePageRoutes>): unknown[] =>
  entries.map((e) => ({
    kind: e.kind,
    label: e.label,
    ...(e.path ? { path: e.path } : {}),
    ...(e.module ? { module: e.module } : {}),
    ...(e.children.length ? { children: shape(e.children) } : {}),
  }))

describe('parsePageRoutes', () => {
  it('reads a flat chain (app kit)', () => {
    expect(shape(parsePageRoutes(fixture('routes-dashboard.ts.txt')))).toEqual([
      { kind: 'page', label: '/', path: '/', module: './pages/home' },
      { kind: 'page', label: '/about', path: '/about', module: './pages/about' },
    ])
  })

  it('nests pages under a pathless layout and keeps the layout module (saas kit)', () => {
    const routes = parsePageRoutes(fixture('routes-saas.ts.txt'))
    expect(shape(routes)).toEqual([
      { kind: 'page', label: '/sign-in', path: '/sign-in', module: './pages/sign-in' },
      {
        kind: 'layout',
        label: '_app',
        module: './layouts/app',
        children: [
          { kind: 'page', label: '/', path: '/', module: './pages/overview' },
          { kind: 'page', label: '/projects', path: '/projects', module: './pages/projects' },
        ],
      },
    ])
    expect(routes[0]?.line).toBe(17)
    expect(routes[1]?.line).toBe(25)
  })

  it('prefixes paths inside a group (site kit)', () => {
    const routes = parsePageRoutes(fixture('routes-site.ts.txt'))
    expect(flattenPages(routes).map((p) => [p.path, p.module])).toEqual([
      ['/', './pages/home'],
      ['/pricing', './pages/pricing'],
      ['/blog', './pages/blog/index'],
      ['/blog/$slug', './pages/blog/post'],
    ])
    expect(routes[2]).toMatchObject({ kind: 'group', label: '/blog' })
  })

  it('reads a page whose options span lines and spread calls (realtime kit)', () => {
    expect(shape(parsePageRoutes(fixture('routes-realtime.ts.txt')))).toEqual([
      { kind: 'page', label: '/', path: '/', module: './pages/chat' },
    ])
  })

  it('ignores calls in comments and strings, and survives template literals', () => {
    const src = `
// .page('/commented', { lazy: () => import('./pages/no') })
/* .layout('nope', {}) */
const s = ".page('/in-a-string')"
const t = \`\${'x'}.page('/in-a-template')\${1}\`
export const routes = defineRoutes([router], (r) =>
  r.root({}).page('/real', { head: () => ({ title: \`Real \${1 + 1}\` }), lazy: () => import("./pages/real") }),
)`
    expect(shape(parsePageRoutes(src))).toEqual([
      { kind: 'page', label: '/real', path: '/real', module: './pages/real' },
    ])
  })

  it('returns nothing for a file that is not a chain', () => {
    expect(parsePageRoutes('export const routes = []')).toEqual([])
    expect(parsePageRoutes('')).toEqual([])
  })
})

describe('paths', () => {
  it('joins group prefixes', () => {
    expect(joinPath('/', '/')).toBe('/')
    expect(joinPath('/blog', '/')).toBe('/blog')
    expect(joinPath('/blog/', '/$slug')).toBe('/blog/$slug')
    expect(joinPath('/a', 'b')).toBe('/a/b')
  })

  it('normalizes relative segments', () => {
    expect(normalize('app/./pages/../layouts/app')).toBe('app/layouts/app')
  })

  it('lists module candidates relative to the routes file', () => {
    expect(
      moduleCandidates(
        { kind: 'page', label: '/', module: './pages/home', line: 0, children: [] },
        'app',
      ),
    ).toEqual([
      'app/pages/home.tsx',
      'app/pages/home.ts',
      'app/pages/home.jsx',
      'app/pages/home.js',
      'app/pages/home/index.tsx',
      'app/pages/home/index.ts',
    ])
    expect(
      moduleCandidates(
        { kind: 'page', label: '/x', path: '/blog/x', line: 0, children: [] },
        'app',
      )[0],
    ).toBe('app/pages/blog/x.tsx')
    expect(
      moduleCandidates({ kind: 'group', label: '/blog', line: 0, children: [] }, 'app'),
    ).toEqual([])
  })

  it('guesses the controller from an API route name', () => {
    expect(controllerCandidates('health')).toEqual(['server/controllers/health-controller.ts'])
    expect(controllerCandidates('auth.signIn')[0]).toBe('server/controllers/auth-controller.ts')
    expect(controllerCandidates('admin.users.index')).toEqual([
      'server/controllers/admin/users-controller.ts',
      'server/controllers/admin/users/index-controller.ts',
      'server/controllers/admin-controller.ts',
    ])
    expect(controllerCandidates('WS /api/ws')).toEqual([])
  })
})
