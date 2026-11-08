import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, copyExample, kitr, read, scratch, write } from './helpers'

afterAll(cleanup)

/**
 * The CLI commands run in-process through `runMain`, on copies of the example projects: the
 * command code, the argument parsing and the exit codes, with the output a person would see.
 */

describe('kitr info and kitr platforms', () => {
  let dir: string
  beforeAll(() => {
    dir = copyExample('fullstack')
  })

  it('info prints the project summary as JSON', async () => {
    const run = await kitr(dir, 'info')
    const info = JSON.parse(run.out)
    expect(info).toMatchObject({ serverOnly: false, packageManager: expect.any(String) })
    expect(info.platforms.site).toMatchObject({ factory: 'web' })
    expect(info.providers).toContain('@kitr/web/provider')
  })

  it('platforms lists each platform, and platforms types lists the kinds', async () => {
    const list = await kitr(dir, 'platforms')
    expect(list.out).toMatch(/site\s+web\s+mode=ssr/)
    expect(list.out).toMatch(/api\s+server/)
    const types = await kitr(dir, 'platforms', 'types')
    for (const type of ['web', 'server']) expect(types.out).toMatch(new RegExp(`\\b${type}\\b`))
  })

  it('config shows the options of a platform, and refuses unknown names and options', async () => {
    const shown = await kitr(dir, 'config', 'site')
    expect(shown.out).toMatch(/site \(web\)/)
    expect(shown.out).toMatch(/mode\s+ssr/)
    const unknown = await kitr(dir, 'config', 'nope')
    expect(unknown.code).toBe(1)
    expect(unknown.err).toMatch(/No platform named "nope"/)
    const option = await kitr(dir, 'config', 'site', 'colour', 'red')
    expect(option.code).toBe(1)
    expect(option.err).toMatch(/no option "colour"/)
  })

  it('dev, build, start and serve reject an unknown platform name', async () => {
    for (const command of ['dev', 'build', 'start', 'serve']) {
      const run = await kitr(dir, command, 'nope')
      expect(run.code, command).toBe(1)
      expect(run.err, command).toMatch(/No platform named "nope"/)
    }
  })

  it('platforms remove needs a name that exists', async () => {
    expect((await kitr(dir, 'platforms', 'remove')).code).toBe(1)
    const missing = await kitr(dir, 'platforms', 'remove', 'nope')
    expect(missing.code).toBe(1)
    expect(missing.err).toMatch(/No platform named "nope"/)
  })

  it('an unknown command is an error, not a crash', async () => {
    const run = await kitr(dir, 'frobnicate')
    expect(run.code).toBe(1)
  })
})

describe('kitr add / remove / config in a project', () => {
  let dir: string
  beforeAll(() => {
    dir = copyExample('dashboard')
  })

  it('add registers a package, is idempotent, and remove takes it out', async () => {
    const added = await kitr(dir, 'add', 'seo', '--no-install', '--yes')
    expect(added.code).toBeUndefined()
    expect(added.out).toMatch(/Changed: .*kitrrc\.ts/)
    expect(read(dir, 'kitrrc.ts')).toMatch(/@kitr\/seo/)
    const again = await kitr(dir, 'add', 'seo', '--no-install', '--yes')
    expect(again.code).toBeUndefined()
    const removed = await kitr(dir, 'remove', 'seo', '--no-install')
    expect(removed.out).toMatch(/removed seo/)
    expect(read(dir, 'kitrrc.ts')).not.toMatch(/@kitr\/seo/)
  })

  it('add --dry-run prints and changes nothing', async () => {
    const before = read(dir, 'kitrrc.ts')
    const run = await kitr(dir, 'add', 'seo', '--no-install', '--dry-run')
    expect(run.out).toMatch(/Would change/)
    expect(read(dir, 'kitrrc.ts')).toBe(before)
  })

  it('add rejects a package it does not know, and remove reports one', async () => {
    const run = await kitr(dir, 'add', 'nope', '--no-install')
    expect(run.code).toBe(1)
    expect(run.err).toMatch(/Unknown package "nope"/)
    const removed = await kitr(dir, 'remove', 'nope', '--no-install')
    expect(removed.err).toMatch(/Unknown package "nope"/)
  })

  it('add <package> --help prints its questions as flags', async () => {
    const run = await kitr(dir, 'add', 'seo', '--help')
    expect(run.out).toMatch(/seo/)
    const unknown = await kitr(dir, 'add', 'nope', '--help')
    expect(unknown.code).toBe(1)
  })

  it('adds a platform, sets and unsets an option, and removes it', async () => {
    await kitr(dir, 'add', 'web', 'admin', '--no-install', '--mode', 'static', '--port', '3002')
    expect((await kitr(dir, 'platforms')).out).toMatch(/admin\s+web\s+mode=static port=3002/)
    await kitr(dir, 'config', 'admin', 'port', '3003')
    expect(read(dir, 'kitrrc.ts')).toMatch(/port: 3003/)
    const bad = await kitr(dir, 'config', 'admin', 'port', 'nope')
    expect(bad.code).toBe(1)
    await kitr(dir, 'config', 'admin', 'port', '--unset')
    expect(read(dir, 'kitrrc.ts')).not.toMatch(/port: 3003/)
    const removed = await kitr(dir, 'platforms', 'remove', 'admin')
    expect(removed.out).toMatch(/removed platforms\.admin/)
    expect(read(dir, 'kitrrc.ts')).not.toContain('admin')
  })
})

describe('kitr config <name> without', () => {
  let dir: string
  beforeAll(() => {
    dir = copyExample('dashboard')
  })

  it('leaves packages out of one platform, and kitr platforms shows its config files', async () => {
    // One kitrrc.ts load per process: jiti caches the module, so each step reads what it wrote.
    const added = await kitr(
      dir,
      'add',
      'web',
      'admin',
      '--no-install',
      '--without',
      'http,storage',
    )
    expect(added.code).toBeUndefined()
    expect(read(dir, 'kitrrc.ts')).toMatch(
      /admin: web\(\{[^}]*without: \[(['"])http\1, \1storage\1\]/,
    )
    mkdirSync(join(dir, 'config/admin'))
    write(dir, 'config/admin/theme.ts', 'export default {}\n')
    const list = (await kitr(dir, 'platforms')).out
    expect(list).toMatch(/admin\s+web\s+.*without=http,storage/)
    const adminFiles = list.slice(list.indexOf('admin'))
    expect(adminFiles).toContain('theme (config/admin/theme.ts)')
    expect(adminFiles).not.toContain('(config/http.ts)')
    expect(list).toContain('http (config/http.ts)')
    expect((await kitr(dir, 'config', 'admin')).out).toMatch(/without\s+http,storage/)
    const set = await kitr(dir, 'config', 'admin', 'without', 'storage')
    expect(set.code).toBeUndefined()
    expect(read(dir, 'kitrrc.ts')).toMatch(/without: \[(['"])storage\1\]/)
    // The standalone server's index follows: one object for admin, picked by the build.
    expect(read(dir, 'config/index.ts')).toContain('export const config = forBuildPlatform({')
    await kitr(dir, 'config', 'admin', 'without', '--unset')
    expect(read(dir, 'kitrrc.ts')).not.toContain('without')
  })
})

describe('kitr types', () => {
  let withActions: string
  let without: string
  beforeAll(() => {
    withActions = copyExample('fullstack')
    without = copyExample('blank')
  })

  it('writes the generated types of a project with actions', async () => {
    const run = await kitr(withActions, 'types')
    expect(run.code).toBeUndefined()
    expect(run.out).toMatch(/file\(s\) written/)
    const files = readdirSync(join(withActions, '.kitr'))
    expect(files).toContain('platforms.d.ts')
    expect(files).toContain('actions.ts')
  })

  it('a project without actions gets platform types and no actions file', async () => {
    const run = await kitr(without, 'types')
    expect(run.code).toBeUndefined()
    const files = readdirSync(join(without, '.kitr'))
    expect(files).toContain('platforms.d.ts')
    expect(files).not.toContain('actions.ts')
  })

  it('--check passes on fresh types and names the stale file after a change', async () => {
    const fresh = await kitr(withActions, 'types', '--check')
    expect(fresh.code).toBeUndefined()
    expect(fresh.out).toMatch(/up to date/)
    rmSync(join(withActions, '.kitr/platforms.d.ts'))
    const stale = await kitr(withActions, 'types', '--check')
    expect(stale.code).toBe(1)
    expect(stale.out).toMatch(/stale: .*platforms\.d\.ts/)
    expect(stale.err).toMatch(/stale\. Run: kitr types/)
    expect(existsSync(join(withActions, '.kitr/platforms.d.ts'))).toBe(false)
    await kitr(withActions, 'types')
    expect(existsSync(join(withActions, '.kitr/platforms.d.ts'))).toBe(true)
  })

  it('--only runs one generator and rejects a name it does not have', async () => {
    const one = await kitr(withActions, 'types', '--only', 'platforms')
    expect(one.code).toBeUndefined()
    expect(one.out).toMatch(/platforms/)
    const bad = await kitr(withActions, 'types', '--only', 'nope')
    expect(bad.code).toBe(1)
    expect(bad.err).toMatch(/No generator named "nope"/)
  })

  it('a changed platform list makes the platform types stale', async () => {
    await kitr(without, 'types')
    await kitr(without, 'add', 'server', 'api', '--no-install')
    const stale = await kitr(without, 'types', '--check')
    expect(stale.code).toBe(1)
    await kitr(without, 'types')
    expect(read(without, '.kitr/platforms.d.ts')).toMatch(/api/)
  })
})

describe('kitr upgrade', () => {
  const pin = (deps: Record<string, string>, dev: Record<string, string> = {}) =>
    `${JSON.stringify({ name: 'shop', version: '1.0.0', dependencies: deps, devDependencies: dev }, null, 2)}\n`
  const pkg = (dir: string) => JSON.parse(read(dir, 'package.json'))
  let dir: string
  afterEach(() => cleanup())

  const project = (json: string) => {
    dir = scratch()
    write(dir, 'package.json', json)
    return dir
  }

  it('moves every kitr package to one version and aligns upstream libraries with the tested set', async () => {
    // The first pinned set: kitr 0.0.1 with an older minor of the libraries.
    project(
      pin({
        '@kitr/kitr': '^0.0.1',
        '@kitr/query': '^0.0.1',
        '@kitr/forms': '^0.0.2',
        '@tanstack/react-query': '^5.0.0',
        'left-pad': '^1.0.0',
        '@kitr/local': 'workspace:*',
      }),
    )
    const run = await kitr(dir, 'upgrade', '--to', '0.7.0', '--no-install')
    expect(run.code).toBeUndefined()
    expect(run.out).toMatch(/Upgrading to kitr 0\.7\.0/)
    expect(run.out).toMatch(/@kitr\/kitr: \^0\.0\.1 → \^0\.7\.0/)
    expect(run.out).toMatch(/@tanstack\/react-query: \^5\.0\.0 →/)
    const after = pkg(dir)
    // Second pinned set: everything kitr is on 0.7.0, the tested upstream version is in.
    expect(after.dependencies['@kitr/kitr']).toBe('^0.7.0')
    expect(after.dependencies['@kitr/query']).toBe('^0.7.0')
    expect(after.dependencies['@kitr/forms']).toBe('^0.7.0')
    expect(after.dependencies['@tanstack/react-query']).not.toBe('^5.0.0')
    // Not kitr's, and workspace links, are left alone.
    expect(after.dependencies['left-pad']).toBe('^1.0.0')
    expect(after.dependencies['@kitr/local']).toBe('workspace:*')
    expect(run.out).toMatch(/kitr doctor/)
  })

  it('lists a major bump instead of applying it, and applies it with --majors', async () => {
    project(pin({ react: '^18.3.1' }, { '@types/react': '^18.3.0' }))
    const listed = await kitr(dir, 'upgrade', '--no-install')
    expect(listed.out).toMatch(/react: \^18\.3\.1 → \^19.* \(major; pass --majors\)/)
    expect(pkg(dir).dependencies.react).toBe('^18.3.1')
    const applied = await kitr(dir, 'upgrade', '--majors', '--no-install')
    expect(applied.out).not.toMatch(/major; pass --majors/)
    expect(pkg(dir).dependencies.react).toMatch(/^\^19/)
    expect(pkg(dir).devDependencies['@types/react']).toMatch(/^\^19/)
  })

  it('never moves a library back to an older version than the project has', async () => {
    project(pin({ '@tanstack/react-query': '^5.999.0' }))
    await kitr(dir, 'upgrade', '--no-install')
    expect(pkg(dir).dependencies['@tanstack/react-query']).toBe('^5.999.0')
  })

  it('--dry-run reports and writes nothing, and an up to date project says so', async () => {
    const before = pin({ '@kitr/kitr': '^0.0.1' })
    project(before)
    const dry = await kitr(dir, 'upgrade', '--to', '0.7.0', '--dry-run')
    expect(dry.out).toMatch(/@kitr\/kitr: \^0\.0\.1 → \^0\.7\.0/)
    expect(read(dir, 'package.json')).toBe(before)
    await kitr(dir, 'upgrade', '--to', '0.7.0', '--no-install')
    const again = await kitr(dir, 'upgrade', '--to', '0.7.0', '--no-install')
    expect(again.out).toMatch(/Already up to date/)
  })
})

describe('kitr doctor', () => {
  let healthy: string
  beforeAll(() => {
    healthy = copyExample('fullstack')
  })

  it('a healthy project has no errors, as a table and as JSON', async () => {
    const table = await kitr(healthy, 'doctor')
    expect(table.out).toMatch(/kitr doctor/)
    expect(table.out).toMatch(/0 error\(s\)/)
    expect(table.code).toBeUndefined()
    const json = await kitr(healthy, 'doctor', '--json')
    const findings = JSON.parse(json.out) as Array<{ level: string }>
    expect(findings.filter((f) => f.level === 'error')).toEqual([])
  })

  it('names a package that kitrrc.ts lists but package.json lacks, with the command that fixes it', async () => {
    const dir = copyExample('dashboard')
    const json = JSON.parse(read(dir, 'package.json'))
    delete json.dependencies['@kitr/forms']
    write(dir, 'package.json', JSON.stringify(json, null, 2))
    const run = await kitr(dir, 'doctor')
    expect(run.code).toBe(1)
    expect(run.out).toMatch(/@kitr\/forms is listed in kitrrc\.ts but not in package\.json/)
    expect(run.out).toMatch(/fix: \S+ add @kitr\/forms/)
    expect(run.out).toMatch(/[1-9]\d* error\(s\)/)
  })

  it('warnings fail the run only with --strict', async () => {
    const dir = copyExample('dashboard')
    // An installed @kitr package that kitrrc.ts does not list is a warning.
    const json = JSON.parse(read(dir, 'package.json'))
    json.dependencies['@kitr/seo'] = '*'
    write(dir, 'package.json', JSON.stringify(json, null, 2))
    const lax = await kitr(dir, 'doctor')
    expect(lax.out).toMatch(/@kitr\/seo is installed but not listed in kitrrc\.ts packages/)
    expect(lax.code).toBeUndefined()
    const strict = await kitr(dir, 'doctor', '--strict')
    expect(strict.code).toBe(1)
  })

  it('reports stale generated types and a missing stylesheet', async () => {
    const dir = copyExample('dashboard')
    write(dir, 'config/tailwind.ts', "export default { entry: 'app/styles/missing.css' }\n")
    const run = await kitr(dir, 'doctor', '--json')
    const messages = (JSON.parse(run.out) as Array<{ message: string }>).map((f) => f.message)
    expect(messages.some((m) => /missing\.css.*does not exist/.test(m))).toBe(true)
    expect(messages.some((m) => /is stale/.test(m))).toBe(true)
  })

  it('without a kitrrc.ts, says so and suggests kitr new', async () => {
    const dir = scratch()
    write(dir, 'package.json', '{"name":"x","dependencies":{}}')
    const run = await kitr(dir, 'doctor', '--json')
    const findings = JSON.parse(run.out) as Array<{ message: string; fix?: string }>
    expect(findings.some((f) => f.message === 'No kitrrc.ts found')).toBe(true)
    expect(run.code).toBe(1)
  })
})

describe('kitr new and kitr eject', () => {
  it('scaffolds a blank app and reads it back', async () => {
    const parent = scratch()
    const run = await kitr(parent, 'new', 'shop', '--kit', 'blank', '--no-install', '--no-git')
    expect(run.code).toBeUndefined()
    const dir = join(parent, 'shop')
    expect(existsSync(join(dir, 'kitrrc.ts'))).toBe(true)
    expect(JSON.parse(read(dir, 'package.json')).name).toBe('shop')
  })

  it('refuses a directory that is not empty, and a kit it does not know', async () => {
    const parent = scratch()
    write(parent, 'file.txt', 'x')
    const full = await kitr(parent, 'new', '.', '--no-install', '--no-git')
    expect(full.code).toBe(1)
    const kit = await kitr(parent, 'new', 'x', '--kit', 'nope', '--no-install', '--no-git')
    expect(kit.code).toBe(1)
    expect(kit.err).toMatch(/Unknown kit/)
  })

  it('--platform replaces the kit platforms', async () => {
    const parent = scratch()
    const run = await kitr(
      parent,
      'new',
      'api-only',
      '--kit',
      'blank',
      '--platform',
      'api=server',
      '--no-install',
      '--no-git',
    )
    expect(run.code).toBeUndefined()
    expect(read(join(parent, 'api-only'), 'kitrrc.ts')).toMatch(/api: server\(/)
  })

  it('eject copies generator stubs, and leaves existing ones unless forced', async () => {
    const dir = copyExample('blank')
    const one = await kitr(dir, 'eject', 'stub', 'provider')
    expect(one.code).toBeUndefined()
    expect(existsSync(join(dir, 'stubs/provider.ts'))).toBe(true)
    const unknown = await kitr(dir, 'eject', 'stub', 'nope')
    expect(unknown.err).toMatch(/Unknown stub "nope"/)
    const all = await kitr(dir, 'eject', 'stubs')
    expect(all.code).toBeUndefined()
    expect(readdirSync(join(dir, 'stubs')).length).toBeGreaterThan(1)
    const noName = await kitr(dir, 'eject', 'stub')
    expect(noName.err).toMatch(/Usage: kitr eject stub <name>/)
  })

  it('make:* generators write files into the project', async () => {
    const dir = copyExample('fullstack')
    const run = await kitr(dir, 'make:controller', 'Report')
    expect(run.code).toBeUndefined()
    expect(existsSync(join(dir, 'server/controllers/report-controller.ts'))).toBe(true)
    const again = await kitr(dir, 'make:controller', 'Report')
    expect(again.code).toBeUndefined()
  })
})
