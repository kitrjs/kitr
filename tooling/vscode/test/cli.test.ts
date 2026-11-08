import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  cliInvocation,
  detectPackageManager,
  extractJson,
  findingLocation,
  lineOf,
  parseFindings,
  parseGenerators,
  parseInfo,
  parseMakeOutput,
  parsePlatformsList,
  parseRoutesList,
  shellQuote,
  summarizeFindings,
} from '../src/cli'

// Every fixture is real CLI output, captured from the examples with NO_COLOR=1.
const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8')

describe('kitr info', () => {
  it('reads the fullstack summary', () => {
    const info = parseInfo(fixture('info-fullstack.json'))
    expect(info.kitr).toBe('0.1.0')
    expect(info.packageManager).toBe('pnpm')
    expect(info.serverOnly).toBe(false)
    expect(info.platforms).toEqual({
      site: { factory: 'web', source: '@kitr/web', options: { mode: 'ssr' } },
      api: { factory: 'server', source: '@kitr/server', options: undefined },
    })
    expect(info.packages).toContain('@kitr/api')
    expect(info.providers[0]).toBe('@kitr/logger')
    expect(info.directories.app).toBe('app')
  })

  it('reads a blank project', () => {
    const info = parseInfo(fixture('info-blank.json'))
    expect(info.platforms).toEqual({})
    expect(info.packages).toEqual([])
  })

  it('skips a log line printed before the JSON', () => {
    const info = parseInfo(`→ loading @acme/kit\n${fixture('info-blank.json')}`)
    expect(info.root).toBe('/home/me/blank')
  })

  it('refuses output that is not a summary', () => {
    expect(() => parseInfo('✖ No kitrrc.ts found')).toThrow(/Expected JSON/)
    expect(() => parseInfo('[]')).toThrow(/not a project summary/)
  })
})

describe('kitr make --json', () => {
  it('reads every generator row', () => {
    const rows = parseGenerators(fixture('make-fullstack.json'))
    expect(rows.length).toBeGreaterThan(10)
    expect(rows.find((r) => r.kind === 'controller')).toMatchObject({
      owner: '@kitr/api',
      pattern: 'server/controllers/<name>-controller.ts',
    })
    expect(rows.find((r) => r.kind === 'service')?.owner).toBe('kitr')
  })
})

describe('kitr make:<kind>', () => {
  it('finds the written file', () => {
    expect(parseMakeOutput(fixture('make-page-output.txt'))).toEqual({
      file: 'app/pages/reports/daily.tsx',
      existed: false,
    })
  })

  it('finds the file it refused to overwrite', () => {
    expect(parseMakeOutput(fixture('make-exists-output.txt'))).toEqual({
      file: 'app/pages/reports/daily.tsx',
      existed: true,
    })
  })

  it('ignores the routing hint after a controller', () => {
    const out =
      "→ write server/controllers/admin/users-controller.ts\n✔ controller: server/controllers/admin/users-controller.ts\n→ route it in server/routes.ts: r.get('/admin/users', [UsersController, 'handle'])\n"
    expect(parseMakeOutput(out)?.file).toBe('server/controllers/admin/users-controller.ts')
  })

  it('returns nothing for an error', () => {
    expect(parseMakeOutput('✖ There is no make:nope generator in this project.')).toBeUndefined()
  })
})

describe('kitr doctor --json', () => {
  const findings = parseFindings(fixture('doctor-errors.json'))

  it('reads levels, messages and fixes', () => {
    expect(findings).toHaveLength(4)
    expect(findings[0]).toEqual({
      level: 'error',
      message: '@kitr/jobs is listed in kitrrc.ts but not in package.json',
      fix: 'pnpm add @kitr/jobs',
    })
    expect(findings[2]?.fix).toBeUndefined()
    expect(summarizeFindings(findings)).toEqual({
      errors: 2,
      warnings: 2,
      text: '2 errors, 2 warnings',
    })
    expect(summarizeFindings([]).text).toBe('No problems found')
  })

  it('locates each finding', () => {
    expect(findings.map(findingLocation)).toEqual([
      { needle: '@kitr/jobs' },
      { file: 'app/pages/bad.tsx' },
      { needle: undefined },
      { file: '.kitr/platforms.d.ts' },
    ])
    expect(
      findingLocation({
        level: 'error',
        message: 'provider "#app/providers/x" file does not exist',
      }),
    ).toEqual({
      needle: '#app/providers/x',
    })
  })

  it('finds the line a needle is on', () => {
    expect(lineOf("a\nb\n  '@kitr/jobs',\n", '@kitr/jobs')).toBe(2)
    expect(lineOf('a\nb', 'missing')).toBe(0)
    expect(lineOf('a\nb', undefined)).toBe(0)
  })
})

describe('kitr routes:list', () => {
  it('reads endpoints', () => {
    const routes = parseRoutesList(fixture('routes-list-saas.txt'))
    expect(routes).toHaveLength(9)
    expect(routes[0]).toEqual({ verb: 'GET', path: '/api/health', name: 'health' })
    expect(routes.at(-1)).toEqual({
      verb: 'DELETE',
      path: '/api/projects/:id',
      name: 'projects.destroy',
    })
  })

  it('reads sockets, whose name is the verb and path', () => {
    expect(parseRoutesList(fixture('routes-list-fullstack.txt'))).toEqual([
      { verb: 'GET', path: '/api/health', name: 'health' },
      { verb: 'WS', path: '/api/ws', name: 'WS /api/ws' },
    ])
  })

  it('ignores error output', () => {
    expect(parseRoutesList('\n✖ Unknown command routes:list\n')).toEqual([])
  })
})

describe('kitr platforms', () => {
  it('reads each platform with its resolved options', () => {
    expect(parsePlatformsList(fixture('platforms-saas.txt'))).toEqual([
      {
        name: 'site',
        type: 'web',
        options: { mode: 'ssr', port: '3000', pwa: 'false', base: '/', open: 'false' },
      },
      {
        name: 'api',
        type: 'server',
        options: { runtime: 'node', port: '3001', entry: 'server/main.ts' },
      },
    ])
  })

  it('reads nothing from a project without platforms', () => {
    expect(parsePlatformsList(fixture('platforms-blank.txt'))).toEqual([])
  })
})

describe('running the CLI', () => {
  it('prefers the configured path, then the local binary, then the package manager', () => {
    expect(cliInvocation({ configured: '/opt/kitr', localBin: '/p/kitr', pm: 'pnpm' })).toEqual({
      command: '/opt/kitr',
      args: [],
    })
    expect(cliInvocation({ localBin: '/p/node_modules/.bin/kitr', pm: 'pnpm' }).command).toBe(
      '/p/node_modules/.bin/kitr',
    )
    expect(cliInvocation({ pm: 'pnpm' })).toEqual({ command: 'pnpm', args: ['exec', 'kitr'] })
    expect(cliInvocation({ pm: 'npm' })).toEqual({ command: 'npx', args: ['kitr'] })
    expect(cliInvocation({ pm: 'yarn' })).toEqual({ command: 'yarn', args: ['kitr'] })
    expect(cliInvocation({ pm: 'bun' })).toEqual({ command: 'bunx', args: ['kitr'] })
  })

  it('detects the package manager', () => {
    expect(detectPackageManager(['package.json', 'pnpm-lock.yaml'])).toBe('pnpm')
    expect(detectPackageManager(['yarn.lock', 'pnpm-lock.yaml'])).toBe('yarn')
    expect(detectPackageManager(['bun.lock'])).toBe('bun')
    expect(detectPackageManager([], 'pnpm@10.28.0')).toBe('pnpm')
    expect(detectPackageManager(['README.md'])).toBe('npm')
  })

  it('quotes arguments only when needed', () => {
    expect(shellQuote('make:page')).toBe('make:page')
    expect(shellQuote('admin/users')).toBe('admin/users')
    expect(shellQuote("it's")).toBe(`'it'\\''s'`)
    expect(shellQuote('a b', true)).toBe('"a b"')
  })

  it('extracts JSON after noise and refuses none', () => {
    expect(extractJson('warn: something\n[1, 2]')).toEqual([1, 2])
    expect(() => extractJson('')).toThrow(/nothing/)
  })
})
