import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { naming } from '@kitr/core/package'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Codemods } from '../src/codemods'
import { runChecks } from '../src/commands/doctor'
import { coreGenerators, renderStub } from '../src/commands/make'
import { createContext, detectPackageManager, findProjectRoot, readRcInfo } from '../src/context'
import { versionOf, versions } from '../src/versions'

const dirs: string[] = []
function project(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'kitr-cli-'))
  dirs.push(dir)
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
  return dir
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  vi.restoreAllMocks()
})
const quiet = () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
}

const rc = `import { defineKitrConfig } from 'kitr/app'

export default defineKitrConfig({
  packages: ['@kitr/query', '@kitr/http'],
  providers: [
    () => import('@kitr/query/provider'),
    // () => import('@kitr/devtools/provider'),
    /* () => import('@kitr/old/provider'), */
    () => import('@kitr/http/provider'),
  ],
  directories: { app: 'src', routes: 'src/pages' },
})
`

describe('readRcInfo', () => {
  it('reads packages, providers and directories, ignoring commented-out providers', () => {
    const dir = project({ 'kitrrc.ts': rc })
    expect(readRcInfo(join(dir, 'kitrrc.ts'))).toEqual({
      packages: ['@kitr/query', '@kitr/http'],
      providers: ['@kitr/query/provider', '@kitr/http/provider'],
      platforms: {},
      directories: {
        app: 'src',
        routes: 'src/pages',
        config: 'config',
        components: 'app/components',
        platforms: 'platforms',
        server: 'server',
        stubs: 'stubs',
      },
    })
  })

  it('reads one-line arrays', () => {
    const dir = project({
      'kitrrc.ts': `export default defineKitrConfig({ packages: ['@kitr/a'], providers: [() => import('@kitr/a/provider')] })`,
    })
    const info = readRcInfo(join(dir, 'kitrrc.ts'))
    expect(info.providers).toEqual(['@kitr/a/provider'])
    expect(info.packages).toEqual(['@kitr/a'])
  })

  it('keeps URLs in strings intact', () => {
    const dir = project({
      'kitrrc.ts': `export default defineKitrConfig({ packages: ['https://x.dev/pkg'], providers: [] })`,
    })
    expect(readRcInfo(join(dir, 'kitrrc.ts')).packages).toEqual(['https://x.dev/pkg'])
  })

  it('returns defaults without an rc file', () => {
    expect(readRcInfo(undefined).providers).toEqual([])
    expect(readRcInfo('/nope/kitrrc.ts').directories.routes).toBe('app/routes')
  })
})

describe('project detection', () => {
  it('detects the package manager from lockfiles, then the user agent', () => {
    expect(detectPackageManager(project({ 'bun.lock': '' }))).toBe('bun')
    expect(detectPackageManager(project({ 'yarn.lock': '' }))).toBe('yarn')
    expect(detectPackageManager(project({ 'package-lock.json': '' }))).toBe('npm')
    expect(detectPackageManager(project({ 'pnpm-lock.yaml': '' }))).toBe('pnpm')
    vi.stubEnv('npm_config_user_agent', 'yarn/4.0.0 npm/? node/v22')
    expect(detectPackageManager(project({}))).toBe('yarn')
    vi.unstubAllEnvs()
  })

  it('finds the project root from a nested folder', () => {
    const dir = project({ 'package.json': '{}', 'app/routes/x.tsx': '' })
    expect(findProjectRoot(join(dir, 'app/routes'))).toBe(dir)
  })

  it('knows a server-only project', () => {
    const server = createContext({
      root: project({ 'package.json': JSON.stringify({ dependencies: { '@kitr/server': '1' } }) }),
    })
    expect(server.isServerOnly()).toBe(true)
    const app = createContext({
      root: project({
        'package.json': JSON.stringify({ dependencies: { '@kitr/server': '1', react: '19' } }),
      }),
    })
    expect(app.isServerOnly()).toBe(false)
  })

  it('write() refuses to overwrite unless asked and honours dry runs', () => {
    quiet()
    const dir = project({ 'a.txt': 'old' })
    const ctx = createContext({ root: dir })
    expect(ctx.write('a.txt', 'new')).toBe(false)
    expect(ctx.write('a.txt', 'new', { overwrite: true })).toBe(true)
    expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('new')
    expect(ctx.write('deep/b.txt', 'b')).toBe(true)
    expect(ctx.touched).toEqual(new Set(['a.txt', 'deep/b.txt']))
    const dry = createContext({ root: dir, dryRun: true })
    expect(dry.write('c.txt', 'c')).toBe(true)
    expect(() => readFileSync(join(dir, 'c.txt'))).toThrow()
  })
})

describe('stubs', () => {
  it('converts names', () => {
    expect(naming.pascal('project-list')).toBe('ProjectList')
    expect(naming.pascal('admin/users')).toBe('AdminUsers')
    expect(naming.camel('project_list')).toBe('projectList')
    expect(naming.snake('ProjectList')).toBe('project_list')
    expect(naming.snake('admin/users-list')).toBe('admin_users_list')
  })

  it('renders every core stub without leaving template holes', () => {
    for (const [kind, generator] of Object.entries(coreGenerators)) {
      const out = renderStub(kind, generator, { name: 'project-list', feature: 'projects' })
      expect(out, kind).not.toMatch(/\$\{(name|feature)\}|undefined|\[object Object\]/)
      expect(out.length, kind).toBeGreaterThan(20)
    }
  })

  it('prefers the project override for a stub', () => {
    const service = coreGenerators.service!
    expect(
      renderStub('service', service, { name: 'x' }, { service: ({ name }) => `custom ${name}` }),
    ).toBe('custom x')
    expect(renderStub('service', service, { name: 'billing' })).toContain('Billing')
  })
})

describe('versions', () => {
  it('pins every blessed dependency to a semver version', () => {
    for (const [name, range] of Object.entries(versions))
      expect(range, name).toMatch(/^\^?\d+\.\d+\.\d+/)
    expect(versionOf('react')).toBe(versions.react)
  })
})

describe('Codemods', () => {
  it('adds and removes providers and packages in kitrrc.ts idempotently', async () => {
    quiet()
    const dir = project({ 'package.json': '{}', 'kitrrc.ts': rc })
    const ctx = createContext({ root: dir })
    const mods = new Codemods(ctx)
    mods.addProvider('@kitr/auth/provider')
    mods.addProvider('@kitr/auth/provider')
    mods.addPackage('@kitr/auth')
    mods.addPackage('@kitr/auth')
    let info = readRcInfo(join(dir, 'kitrrc.ts'))
    expect(info.providers.filter((p) => p === '@kitr/auth/provider')).toHaveLength(1)
    expect(info.packages.filter((p) => p === '@kitr/auth')).toHaveLength(1)
    mods.removeProvider('@kitr/auth/provider')
    mods.removePackage('@kitr/auth')
    info = readRcInfo(join(dir, 'kitrrc.ts'))
    expect(info.providers).not.toContain('@kitr/auth/provider')
    expect(info.packages).not.toContain('@kitr/auth')
    expect(info.providers).toContain('@kitr/query/provider')
  })

  it('creates kitrrc.ts when missing and writes queued dependencies on flush', async () => {
    quiet()
    const dir = project({
      'package.json': JSON.stringify({ name: 'x', dependencies: { old: '1', react: '18' } }),
    })
    const ctx = createContext({ root: dir })
    const mods = new Codemods(ctx)
    mods.addPackage('@kitr/http')
    mods.installPackages([
      '@kitr/http',
      'ky',
      { name: 'vitest', dev: true },
      { name: 'custom', version: '^9.9.9' },
    ])
    mods.removePackages(['old'])
    await mods.flush({ install: false })
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    expect(pkg.dependencies).toMatchObject({
      '@kitr/http': `^${ctx.kitrVersion}`,
      ky: versions.ky,
      custom: '^9.9.9',
      react: '18',
    })
    expect(pkg.dependencies.old).toBeUndefined()
    expect(pkg.devDependencies.vitest).toBe(versions.vitest)
    expect(readRcInfo(join(dir, 'kitrrc.ts')).packages).toEqual(['@kitr/http'])
  })

  it('adds a Vite plugin once', () => {
    quiet()
    const dir = project({
      'package.json': '{}',
      'vite.config.ts': `import { defineConfig } from 'vite'\n\nexport default defineConfig({\n  plugins: [],\n})\n`,
    })
    const mods = new Codemods(createContext({ root: dir }))
    mods.addVitePlugin('pwa', '@kitr/pwa/vite')
    mods.addVitePlugin('pwa', '@kitr/pwa/vite')
    const src = readFileSync(join(dir, 'vite.config.ts'), 'utf8')
    expect(src.match(/@kitr\/pwa\/vite/g)).toHaveLength(1)
    expect(src).toMatch(/plugins: \[\s*pwa\(\)\s*\]/)
  })

  it('adds typed env variables and .env.example entries', () => {
    quiet()
    const dir = project({
      'package.json': '{}',
      'app/env.ts': `import { createEnv, env as e } from 'kitr/env'\n\nexport const env = createEnv({\n  public: {},\n})\n`,
    })
    const mods = new Codemods(createContext({ root: dir }))
    mods.addEnvSchema(
      'public',
      'VITE_API_URL',
      "e.url({ default: 'http://localhost:3333' })",
      'http://localhost:3333',
    )
    mods.addEnvSchema('server', 'SECRET', 'e.string()')
    mods.addEnvSchema('public', 'VITE_API_URL', 'e.string()')
    const env = readFileSync(join(dir, 'app/env.ts'), 'utf8')
    expect(env.match(/VITE_API_URL/g)).toHaveLength(1)
    expect(env).toContain('SECRET: e.string()')
    expect(readFileSync(join(dir, '.env.example'), 'utf8')).toContain(
      'VITE_API_URL=http://localhost:3333',
    )
  })
})

describe('doctor', () => {
  it('finds missing dependencies, unlisted packages and unresolvable providers', () => {
    const dir = project({
      'package.json': JSON.stringify({ dependencies: { '@kitr/query': '1', '@kitr/auth': '1' } }),
      'kitrrc.ts': rc,
    })
    const findings = runChecks(createContext({ root: dir }))
    const messages = findings.map((f) => `${f.level}: ${f.message}`)
    expect(messages).toContain('error: `kitr` is not a dependency')
    expect(messages).toContain('error: @kitr/http is listed in kitrrc.ts but not in package.json')
    expect(messages).toContain('warn: @kitr/auth is installed but not listed in kitrrc.ts packages')
    for (const f of findings.filter((f) => f.level !== 'info'))
      expect(f.fix, f.message).toBeTruthy()
  })

  it('reports no errors for the generated examples', () => {
    for (const example of ['backend', 'dashboard', 'fullstack']) {
      const findings = runChecks(
        createContext({ root: join(__dirname, '../../../examples', example) }),
      )
      expect(
        findings.filter((f) => f.level === 'error'),
        example,
      ).toEqual([])
    }
  })
})
