import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FAN_OUT_COMMANDS,
  fanOut,
  findWorkspace,
  findWorkspacePath,
  readWorkspace,
  resolveApp,
  shouldFanOut,
  takeAppFlag,
  takeFilterFlag,
} from '../src/workspace'

function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'kitr-ws-'))
  writeFileSync(
    join(root, 'kitr.workspace.ts'),
    `import { defineWorkspace } from '@kitr/kitr'
// the apps
export default defineWorkspace({
  apps: {
    web: 'apps/web', // authed web app
    phone: "apps/phone",
    'www': 'apps/www',
  },
  packages: ['packages/*'],
})
`,
  )
  for (const app of ['web', 'phone', 'www']) {
    mkdirSync(join(root, 'apps', app), { recursive: true })
    writeFileSync(join(root, 'apps', app, 'package.json'), '{}')
  }
  writeFileSync(
    join(root, 'apps/web/kitrrc.ts'),
    `export default defineKitrConfig({ platforms: { site: web({ mode: 'ssr' }) }, providers: [], packages: ['router'] })`,
  )
  mkdirSync(join(root, 'packages/ui'), { recursive: true })
  return root
}

describe('kitr.workspace.ts', () => {
  it('is found above any app directory and lists the apps as absolute paths', () => {
    const root = workspace()
    expect(findWorkspacePath(join(root, 'apps/web'))).toBe(join(root, 'kitr.workspace.ts'))
    expect(findWorkspacePath(join(root, 'packages/ui'))).toBe(join(root, 'kitr.workspace.ts'))
    const ws = readWorkspace(join(root, 'kitr.workspace.ts'))
    expect(ws.root).toBe(root)
    expect(ws.apps).toEqual({
      web: join(root, 'apps/web'),
      phone: join(root, 'apps/phone'),
      www: join(root, 'apps/www'),
    })
    expect(findWorkspace(tmpdir())).toBeUndefined()
  })

  it('turns --filter into the names after the command', () => {
    expect(takeFilterFlag(['build', '--filter=admin,api', '--minify'])).toEqual([
      'build',
      'admin',
      'api',
      '--minify',
    ])
    expect(takeFilterFlag(['--filter', 'phone', 'dev', '--filter=www'])).toEqual([
      'dev',
      'phone',
      'www',
    ])
    expect(takeFilterFlag(['types'])).toEqual(['types'])
    expect(() => takeFilterFlag(['dev', '--filter'])).toThrow(/--filter needs names/)
    expect(() => takeFilterFlag(['dev', '--filter=,'])).toThrow(/--filter needs names/)
    expect(() => takeFilterFlag(['types', '--filter=a'])).toThrow(/kitr dev, kitr build/)
  })

  it('takes --app out of the arguments, from either spelling or KITR_APP', () => {
    expect(takeAppFlag(['add', 'jobs', '--app', 'web', '--yes'])).toEqual({
      app: 'web',
      argv: ['add', 'jobs', '--yes'],
    })
    expect(takeAppFlag(['--app=phone', 'build'])).toEqual({ app: 'phone', argv: ['build'] })
    expect(() => takeAppFlag(['dev', '--app'])).toThrow(/--app needs an app name/)
    process.env.KITR_APP = 'www'
    try {
      expect(takeAppFlag(['types']).app).toBe('www')
    } finally {
      delete process.env.KITR_APP
    }
  })

  it('resolves an app directory and names the apps when one is unknown', () => {
    const root = workspace()
    const ws = findWorkspace(root)!
    expect(resolveApp(ws, 'phone')).toBe(join(root, 'apps/phone'))
    expect(() => resolveApp(ws, 'tablet')).toThrow(/No app "tablet".*web, phone, www/)
    expect(() => resolveApp(undefined, 'web')).toThrow(/no kitr.workspace.ts/)
  })

  it('fans out only fan-out commands typed outside an app', () => {
    const root = workspace()
    expect(shouldFanOut(['dev'], root)?.root).toBe(root)
    expect(shouldFanOut(['build', 'phone'], join(root, 'packages/ui'))?.root).toBe(root)
    // Inside an app the command is the app's own.
    expect(shouldFanOut(['dev'], join(root, 'apps/web'))).toBeUndefined()
    // Not a fan-out command, or asking for help.
    expect(shouldFanOut(['add', 'jobs'], root)).toBeUndefined()
    expect(shouldFanOut(['dev', '--help'], root)).toBeUndefined()
    expect(shouldFanOut([], root)).toBeUndefined()
    expect(shouldFanOut(['dev'], tmpdir())).toBeUndefined()
    expect([...FAN_OUT_COMMANDS]).toContain('types')
  })

  it('runs every app one after another, or the named apps, side by side for dev', async () => {
    const root = workspace()
    const ws = findWorkspace(root)!
    const calls: Array<[string, string[]]> = []
    const run = async (_dir: string, name: string, args: string[]) => {
      calls.push([name, args])
    }
    await fanOut(ws, ['build', '--minify'], { run })
    expect(calls).toEqual([
      ['web', ['build', '--minify']],
      ['phone', ['build', '--minify']],
      ['www', ['build', '--minify']],
    ])
    calls.length = 0
    // An app name as a word selects the app and is not passed on as a platform name.
    await fanOut(ws, ['build', 'phone', 'site'], { run })
    expect(calls).toEqual([['phone', ['build', 'site']]])
    calls.length = 0
    let concurrent = 0
    let peak = 0
    await fanOut(ws, ['dev'], {
      run: async (_d, name) => {
        concurrent++
        peak = Math.max(peak, concurrent)
        await new Promise((r) => setTimeout(r, 5))
        calls.push([name, []])
        concurrent--
      },
    })
    expect(peak).toBe(3)
    expect(calls).toHaveLength(3)
  })
})
