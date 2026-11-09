import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateChecks } from '../src/commands/doctor'
import { createContext } from '../src/context'
import { loadAppSteps, loadGenerateSteps, runGenerate } from '../src/generate'

const dirs: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

/** A project that lists `@acme/sync`, a package whose setup module declares a generate step. */
function project(command: string, body: string) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'kitr-generate-')))
  dirs.push(dir)
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'demo', type: 'module' }),
    'kitrrc.ts': `import { defineKitrConfig } from '@kitr/kitr/app'\nexport default defineKitrConfig({ packages: ['@acme/sync'], providers: [] })\n`,
    'node_modules/@acme/sync/package.json': JSON.stringify({
      name: '@acme/sync',
      type: 'module',
      exports: { './kitr': './kitr.mjs', './package.json': './package.json' },
    }),
    'node_modules/@acme/sync/kitr.mjs': `export default {
  name: 'sync',
  commands: () => import('./commands.mjs'),
  generate: { command: '${command}', watch: ['src/**/*.ts'] },
}\n`,
    'node_modules/@acme/sync/commands.mjs': `import { writeFileSync } from 'node:fs'
export const sync = {
  meta: { name: 'acme:sync' },
  run() {
    ${body}
  },
}\n`,
  }
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
  return dir
}

describe('kitr generate', () => {
  it('runs the type generators, then the step a package declares, from the project root', async () => {
    const dir = project('acme:sync', `writeFileSync('synced.txt', process.cwd())`)
    const result = await runGenerate(createContext({ root: dir }), { quiet: true })
    expect(result.types.generators).toContain('platforms')
    expect(result.steps).toEqual(['@acme/sync:acme:sync'])
    expect(existsSync(join(dir, '.kitr/platforms.d.ts'))).toBe(true)
    expect(readFileSync(join(dir, 'synced.txt'), 'utf8')).toBe(dir)
    const steps = await loadGenerateSteps(createContext({ root: dir }))
    expect(steps.map((s) => s.watch)).toEqual([['src/**/*.ts']])
  })

  it('fails on a step that does not run, or only warns when not strict', async () => {
    const dir = project('acme:missing', `writeFileSync('synced.txt', 'x')`)
    const ctx = createContext({ root: dir })
    await expect(runGenerate(ctx, { quiet: true })).rejects.toThrow(/has no such command/)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const lenient = await runGenerate(ctx, { quiet: true, strict: false })
    expect(lenient.steps).toEqual([])
    expect(lenient.failed).toHaveLength(1)
  })

  it('skips package steps with --check and reports stale type files', async () => {
    const dir = project('acme:sync', `writeFileSync('synced.txt', 'x')`)
    const result = await runGenerate(createContext({ root: dir }), { check: true, quiet: true })
    expect(result.steps).toEqual([])
    expect(result.types.stale).toContain('.kitr/platforms.d.ts')
    expect(existsSync(join(dir, 'synced.txt'))).toBe(false)
  })

  it("runs the app's own steps from kitrrc.ts last: a shell command and a function", async () => {
    const dir = project('acme:sync', `writeFileSync('order.txt', 'package')`)
    writeFileSync(
      join(dir, 'kitrrc.ts'),
      `export default {
  packages: ['@acme/sync'],
  providers: [],
  generate: [
    { name: 'content', run: 'node scripts/content.mjs', watch: ['content/**'] },
    { name: 'icons', run: () => import('./scripts/icons.mjs') },
  ],
}
`,
    )
    mkdirSync(join(dir, 'scripts'))
    writeFileSync(
      join(dir, 'scripts/content.mjs'),
      `import { appendFileSync } from 'node:fs'\nappendFileSync('order.txt', ' content:' + process.env.KITR_GENERATE)\n`,
    )
    writeFileSync(
      join(dir, 'scripts/icons.mjs'),
      `import { appendFileSync } from 'node:fs'\nexport default () => appendFileSync('order.txt', ' icons')\n`,
    )
    const result = await runGenerate(createContext({ root: dir }), { quiet: true })
    expect(result.steps).toEqual(['@acme/sync:acme:sync', 'app:content', 'app:icons'])
    expect(readFileSync(join(dir, 'order.txt'), 'utf8')).toBe('package content:1 icons')
    const steps = await loadGenerateSteps(createContext({ root: dir }))
    expect(steps.map((s) => s.watch)).toEqual([['src/**/*.ts'], ['content/**'], []])
    // kitr doctor lists them, so the steps are not invisible.
    expect((await generateChecks(createContext({ root: dir }))).map((f) => f.message)).toEqual([
      'kitr generate runs app:content (node scripts/content.mjs) after the type generators',
      'kitr generate runs app:icons (a function) after the type generators',
    ])
  })

  it('skips app steps with --check, and names a failing command', async () => {
    const dir = project('acme:sync', '')
    writeFileSync(
      join(dir, 'kitrrc.ts'),
      `export default { packages: [], providers: [], generate: [{ name: 'content', run: 'node -e "process.exit(3)"' }] }\n`,
    )
    const ctx = createContext({ root: dir })
    expect((await runGenerate(ctx, { check: true, quiet: true })).steps).toEqual([])
    await expect(runGenerate(ctx, { quiet: true })).rejects.toThrow(
      /app:content failed: `node -e "process.exit\(3\)"` exited with code 3/,
    )
  })

  it('reads kitrrc.ts only when it lists steps, and rejects a step without run', async () => {
    const dir = project('acme:sync', '')
    // Executing this file would throw: without `generate:` it is never executed.
    writeFileSync(join(dir, 'kitrrc.ts'), `throw new Error('executed')\nexport default {}\n`)
    expect(await loadAppSteps(createContext({ root: dir }))).toEqual([])
    writeFileSync(join(dir, 'kitrrc.ts'), `export default { generate: [{ name: 'content' }] }\n`)
    await expect(loadAppSteps(createContext({ root: dir }))).rejects.toThrow(
      /generate\[0\] needs a `name` and a `run`/,
    )
  })
})
