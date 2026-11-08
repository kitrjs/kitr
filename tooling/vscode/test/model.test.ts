import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseGenerators, parseInfo, parsePlatformsList, parseRoutesList } from '../src/cli'
import {
  generatorNodes,
  packageNodes,
  platformNodes,
  providerNodes,
  routeNodes,
} from '../src/model'
import { parsePageRoutes } from '../src/routes'

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8')
const info = parseInfo(fixture('info-fullstack.json'))

/** A project with these files. */
const files =
  (...existing: string[]) =>
  (candidates: string[]) =>
    candidates.find((c) => existing.includes(c))

describe('Platforms', () => {
  it('shows the type and the key resolved options', () => {
    const nodes = platformNodes(info, parsePlatformsList(fixture('platforms-saas.txt')))
    expect(nodes.map((n) => [n.label, n.description, n.icon, n.contextValue])).toEqual([
      ['site', 'web · mode=ssr · port=3000', 'globe', 'platform'],
      ['api', 'server · runtime=node · port=3001', 'server', 'platform'],
    ])
    expect(nodes[0]?.tooltip).toContain('kitr dev site')
  })

  it('falls back to the options in kitrrc.ts', () => {
    expect(platformNodes(info)[0]?.description).toBe('web · mode=ssr')
  })
})

describe('Packages', () => {
  it('opens the config file when there is one and ends with Add package…', () => {
    const nodes = packageNodes(info, files('config/auth.ts', 'config/query.ts'))
    expect(nodes.find((n) => n.label === 'auth')).toMatchObject({
      open: 'config/auth.ts',
      icon: 'gear',
    })
    expect(nodes.find((n) => n.label === 'react')).toMatchObject({
      open: undefined,
      description: '@kitr/react',
    })
    expect(nodes.at(-1)).toMatchObject({
      label: 'Add package…',
      command: { command: 'kitr.addPackage', arguments: [] },
    })
    expect(nodes).toHaveLength(info.packages.length + 1)
  })
})

describe('Providers', () => {
  it('opens kitrrc.ts on the line of the provider', () => {
    const rc =
      "export default defineKitrConfig({\n  packages: ['@kitr/logger'],\n  providers: [\n   () => import('@kitr/logger'),\n  ],\n})\n"
    const nodes = providerNodes(info, rc)
    expect(nodes[0]).toMatchObject({ label: '@kitr/logger', open: 'kitrrc.ts', line: 3 })
    expect(nodes[1]?.line).toBeUndefined()
  })
})

describe('Routes', () => {
  it('nests pages and lists API routes with their controllers', () => {
    const nodes = routeNodes({
      pages: parsePageRoutes(fixture('routes-saas.ts.txt')),
      api: parseRoutesList(fixture('routes-list-saas.txt')),
      appDir: 'app',
      find: files(
        'app/pages/sign-in.tsx',
        'app/pages/overview.tsx',
        'app/layouts/app.tsx',
        'server/controllers/projects-controller.ts',
        'server/controllers/auth-controller.ts',
        'server/routes.ts',
      ),
    })
    expect(nodes.map((n) => n.label)).toEqual(['Pages', 'API'])
    const pages = nodes[0]!.children!
    expect(pages.map((p) => [p.label, p.open])).toEqual([
      ['/sign-in', 'app/pages/sign-in.tsx'],
      ['_app', 'app/layouts/app.tsx'],
    ])
    // A page whose file is missing opens app/routes.ts on its line.
    expect(pages[1]!.children!.map((p) => [p.label, p.open, p.line])).toEqual([
      ['/', 'app/pages/overview.tsx', undefined],
      ['/projects', 'app/routes.ts', 44],
    ])
    const api = nodes[1]!.children!
    expect(api[0]).toMatchObject({ label: 'GET /api/health', open: 'server/routes.ts' })
    expect(api[1]).toMatchObject({
      label: 'POST /api/auth/sign-in',
      description: 'auth.signIn',
      open: 'server/controllers/auth-controller.ts',
    })
    expect(api[4]?.open).toBe('server/controllers/projects-controller.ts')
    expect(new Set([...pages, ...api].map((n) => n.id)).size).toBe(pages.length + api.length)
  })

  it('shows nothing without routes', () => {
    expect(routeNodes({ pages: [], api: [], appDir: 'app', find: files() })).toEqual([])
  })
})

describe('Generators', () => {
  it('runs kitr.make with the kind', () => {
    const nodes = generatorNodes(parseGenerators(fixture('make-fullstack.json')))
    expect(nodes.find((n) => n.label === 'make:controller')).toMatchObject({
      description: 'server/controllers/<name>-controller.ts',
      contextValue: 'generator',
      command: { command: 'kitr.make', arguments: ['controller'] },
    })
  })
})
