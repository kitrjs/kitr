import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bin, copyExample, exists, kitr, remove, root, run, snapshot } from './helpers'

describe('examples are the unmodified output of the kits', () => {
  it('sync-examples --check reports no drift', () => {
    try {
      execFileSync(process.execPath, [join(root, 'scripts/sync-examples.mjs'), '--check'], {
        stdio: 'pipe',
        encoding: 'utf8',
      })
    } catch (error: any) {
      throw new Error(error.stderr || error.message)
    }
  })
})

describe('kitr new', () => {
  let tmp: string
  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'kitr-new-'))
  })
  afterAll(() => remove(tmp))

  it.each(['blank', 'app', 'fullstack', 'server', 'saas', 'site', 'realtime', 'desktop', 'mobile'])(
    'kit %s writes a valid project',
    (kit) => {
      kitr(
        tmp,
        'new',
        kit,
        '--kit',
        kit,
        '--no-install',
        '--no-git',
        '--registry',
        join(root, 'registry/dist'),
      )
      const dir = join(tmp, kit)
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
      expect(pkg.name).toBe(kit)
      expect(pkg.type).toBe('module')
      expect(exists(dir, 'kitrrc.ts')).toBe(true)
      expect(exists(dir, 'AGENTS.md')).toBe(true)
      // Every provider in kitrrc.ts has its package in package.json.
      const rc = readFileSync(join(dir, 'kitrrc.ts'), 'utf8')
      for (const [, name] of rc.matchAll(/'(@kitr\/[\w.-]+)'/g))
        expect(pkg.dependencies?.[name!] ?? pkg.devDependencies?.[name!], name).toBeDefined()
    },
  )

  it.each(['blank', 'app', 'fullstack', 'server', 'saas', 'site', 'realtime', 'desktop', 'mobile'])(
    'kit %s passes its own lint once formatted (what `new` does after install)',
    (kit) => {
      const dir = join(tmp, kit)
      try {
        run(dir, bin('biome'), ['check', '--write', '.'])
      } catch {}
      run(dir, bin('biome'), ['check', '--error-on-warnings', '.'])
    },
  )

  it('refuses a non-empty directory without --force', () => {
    expect(() => kitr(tmp, 'new', 'blank', '--kit', 'blank', '--no-install', '--no-git')).toThrow()
  })

  it('rejects an unknown kit', () => {
    expect(() => kitr(tmp, 'new', 'x', '--kit', 'nope', '--no-install', '--no-git')).toThrow(
      /Unknown kit/,
    )
  })
})

describe.each([
  'blank',
  'backend',
  'dashboard',
  'fullstack',
  'saas',
  'site',
  'realtime',
  'desktop',
  'mobile',
])('example %s', (name) => {
  const dir = join(root, 'examples', name)

  it('typechecks after kitr types', () => {
    kitr(dir, 'types')
    run(dir, bin('tsc'), ['--noEmit', '-p', '.'])
  })

  it('passes kitr doctor with no errors', () => {
    const findings = JSON.parse(kitr(dir, 'doctor', '--json')) as Array<{
      level: string
      message: string
    }>
    expect(findings.filter((f) => f.level === 'error')).toEqual([])
  })

  it('lists its routes and info without failing', () => {
    expect(kitr(dir, 'info')).toMatch(/kitr/)
  })
})

describe('make:* generators produce code that typechecks and builds', () => {
  let dir: string
  beforeAll(() => {
    dir = copyExample('fullstack')
  })
  afterAll(() => remove(dir))

  const generators: Array<[string, string, string]> = [
    ['make:route', 'reports', 'app/routes/reports.tsx'],
    ['make:query', 'projects/list', 'app/actions/projects/list.ts'],
    ['make:mutation', 'projects/archive', 'app/actions/projects/archive.ts'],
    ['make:controller', 'invoices', 'server/controllers/invoices_controller.ts'],
    ['make:middleware', 'audit', 'app/middleware/audit.ts'],
    ['make:channel', 'presence', 'app/channels/presence.ts'],
    ['make:store', 'filters', 'app/stores/filters.ts'],
    ['make:form', 'invite', 'app/components/forms/invite_form.tsx'],
    ['make:queries', 'invoices', 'app/features/invoices/queries.ts'],
    ['make:provider', 'flags', 'app/providers/flags_provider.ts'],
    ['make:job', 'SendReceipt', 'server/jobs/send_receipt.ts'],
    ['make:mail', 'welcome', 'server/mail/welcome.tsx'],
    ['make:service', 'billing', 'server/services/billing_service.ts'],
    ['make:validator', 'project', 'app/validators/project.ts'],
    ['make:test', 'billing', 'test/billing.test.ts'],
    ['make:component', 'StatCard', 'app/components/stat-card.tsx'],
    ['make:hook', 'disclosure', 'app/hooks/use-disclosure.ts'],
    ['make:exception', 'QuotaExceeded', 'app/exceptions/quota_exceeded_error.ts'],
  ]

  it.each(generators)('%s %s writes %s', (command, arg, file) => {
    const out = kitr(dir, command, arg)
    expect(out).toContain(`write ${file}`)
    expect(exists(dir, file)).toBe(true)
  })

  it('leaves an existing file alone without --force, and overwrites with it', () => {
    const file = join(dir, 'app/stores/filters.ts')
    writeFileSync(file, `${readFileSync(file, 'utf8')}// edited\n`)
    expect(kitr(dir, 'make:store', 'filters')).toMatch(/exists \(use --force\)/)
    expect(readFileSync(file, 'utf8')).toContain('// edited')
    kitr(dir, 'make:store', 'filters', '--force')
    expect(readFileSync(file, 'utf8')).not.toContain('// edited')
  })

  it('make:controller --resource writes every action', () => {
    kitr(dir, 'make:controller', 'customers', '--resource')
    const files = Object.keys(snapshot(join(dir, 'server/controllers')))
    const file = files.find((f) => f.includes('customers'))!
    const src = readFileSync(join(dir, 'server/controllers', file), 'utf8')
    for (const action of ['index', 'show', 'store', 'update', 'destroy'])
      expect(src).toMatch(new RegExp(`\\b${action}\\s*\\(`))
  })

  it('the project still builds and typechecks with every generated file', () => {
    kitr(dir, 'build', 'site')
    run(dir, bin('tsc'), ['--noEmit', '-p', '.'])
  }, 300_000)

  it("the generated test runs and passes with the project's vitest", () => {
    const out = run(dir, bin('vitest'), ['run', 'test/billing.test.ts'])
    expect(out).toMatch(/1 passed/)
  }, 120_000)

  it("generated code passes the project's lint", () => {
    run(dir, bin('biome'), [
      'check',
      'server/jobs',
      'server/mail',
      'server/services',
      'app/validators',
      'test',
      'app/hooks',
      'app/exceptions',
      'app/components/stat-card.tsx',
    ])
  })

  it('doctor stays clean after generating', () => {
    const findings = JSON.parse(kitr(dir, 'doctor', '--json')) as Array<{ level: string }>
    expect(findings.filter((f) => f.level === 'error')).toEqual([])
  })
})

describe('kitr add / remove', () => {
  let dir: string
  let before: Record<string, string>
  beforeAll(() => {
    dir = copyExample('dashboard')
    // An installed project has been through `biome check --write` (see `kitr new`).
    try {
      run(dir, bin('biome'), ['check', '--write', '.'])
    } catch {}
    before = snapshot(dir)
  })
  afterAll(() => remove(dir))

  const addable = ['i18n', 'analytics', 'monitoring', 'logger', 'platform', 'seo']

  it.each(addable)('add %s registers the provider and package, remove undoes it', (pkg) => {
    kitr(dir, 'add', pkg, '--no-install')
    const rc = readFileSync(join(dir, 'kitrrc.ts'), 'utf8')
    const json = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    expect(json.dependencies[`@kitr/${pkg}`]).toBeDefined()
    expect(rc).toContain(`@kitr/${pkg}`)

    const once = snapshot(dir)
    kitr(dir, 'add', pkg, '--no-install')
    expect(snapshot(dir), 'add is idempotent').toEqual(once)

    kitr(dir, 'remove', pkg, '--no-install')
    const after = snapshot(dir)
    expect(after['kitrrc.ts']).toBe(before['kitrrc.ts'])
    expect(after['package.json']).toBe(before['package.json'])
  })

  it('--dry-run changes nothing', () => {
    const now = snapshot(dir)
    kitr(dir, 'add', 'realtime', '--no-install', '--dry-run')
    expect(snapshot(dir)).toEqual(now)
  })

  it('add realtime brings its dependencies; remove realtime keeps them and lists leftover imports', () => {
    kitr(dir, 'add', 'realtime', '--no-install')
    const rc = readFileSync(join(dir, 'kitrrc.ts'), 'utf8')
    for (const dep of ['@kitr/realtime', '@kitr/server', '@kitr/logger']) expect(rc).toContain(dep)
    const out = kitr(dir, 'remove', 'realtime', '--no-install')
    expect(out).toMatch(/Still imported from/)
    const after = readFileSync(join(dir, 'kitrrc.ts'), 'utf8')
    expect(after).not.toContain('@kitr/realtime')
    expect(after).toContain('@kitr/server')
  })

  it('add <type> <name> registers a platform in kitrrc.ts and kitr config edits it', () => {
    kitr(dir, 'add', 'web', 'admin', '--no-install', '--mode', 'static', '--port', '3002')
    const rc = readFileSync(join(dir, 'kitrrc.ts'), 'utf8')
    expect(rc).toMatch(/admin: web\(\{[^}]*mode: 'static'/)
    expect(kitr(dir, 'platforms')).toMatch(/admin\s+web\s+mode=static port=3002/)
    kitr(dir, 'config', 'admin', 'port', '3003')
    expect(readFileSync(join(dir, 'kitrrc.ts'), 'utf8')).toMatch(/port: 3003/)
    expect(() => kitr(dir, 'config', 'admin', 'port', 'nope')).toThrow(/expected a number/)
    expect(() => kitr(dir, 'config', 'admin', 'mode', 'fast')).toThrow()
    kitr(dir, 'platforms', 'remove', 'admin')
    expect(readFileSync(join(dir, 'kitrrc.ts'), 'utf8')).not.toContain('admin')
  })

  it('rejects an unknown package', () => {
    expect(() => kitr(dir, 'add', 'nope', '--no-install')).toThrow()
  })
})
