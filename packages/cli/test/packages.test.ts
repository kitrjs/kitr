import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Question } from '@kitr/core/package'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createAddContext, createProjectInfo } from '../src/add-context'
import { Codemods, extensionLocalName } from '../src/codemods'
import { createContext } from '../src/context'
import { resolvePlan } from '../src/plan'
import { coerceAnswer, describeQuestions, resolveAnswers } from '../src/questions'

const dirs: string[] = []
function project(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'kitr-pkg-'))
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
}

const rc = `import { defineKitrConfig } from 'kitr/app'

export default defineKitrConfig({
  packages: ['@kitr/server'],
  providers: [],
  directories: { app: 'app', config: 'config', server: 'server' },
})
`
const pkg = JSON.stringify({
  name: 'demo',
  type: 'module',
  dependencies: { kitr: '^0.1.0', '@kitr/core': '^0.1.0', '@kitr/server': '^0.1.0' },
})

describe('questions', () => {
  const questions: Question[] = [
    {
      name: 'driver',
      type: 'select',
      message: 'Where do jobs queue?',
      default: 'memory',
      options: [{ value: 'memory' }, { value: 'redis', label: 'Redis' }],
    },
    {
      name: 'worker',
      type: 'confirm',
      message: 'Run the worker here?',
      default: true,
      when: (answers) => answers.driver === 'redis',
    },
    {
      name: 'targets',
      type: 'multiselect',
      message: 'Targets',
      options: [{ value: 'ios' }, { value: 'android' }],
    },
    {
      name: 'port',
      type: 'text',
      message: 'Port',
      default: '3000',
      validate: (v) => (/^\d+$/.test(String(v)) ? undefined : 'must be a number'),
    },
  ]
  const info = () => createProjectInfo(createContext({ root: project({ 'package.json': pkg }) }))

  it('takes defaults when nothing is asked, and skips questions whose `when` is false', async () => {
    const answers = await resolveAnswers(questions, {}, info(), { yes: true })
    expect(answers).toEqual({ driver: 'memory', targets: undefined, port: '3000' })
    expect('worker' in answers).toBe(false)
  })

  it('reads flags, coerces them to the question type and evaluates `when` with earlier answers', async () => {
    const answers = await resolveAnswers(
      questions,
      { driver: 'redis', worker: false, targets: 'ios,android', port: '4000' },
      info(),
      { yes: true },
    )
    expect(answers).toEqual({
      driver: 'redis',
      worker: false,
      targets: ['ios', 'android'],
      port: '4000',
    })
  })

  it('rejects a flag outside the options and a value the question refuses', async () => {
    await expect(
      resolveAnswers(questions, { driver: 'sqs' }, info(), { yes: true }),
    ).rejects.toThrow(/--driver expects one of memory, redis/)
    await expect(resolveAnswers(questions, { port: 'abc' }, info(), { yes: true })).rejects.toThrow(
      /--port: must be a number/,
    )
    expect(() => coerceAnswer(questions[1]!, 'maybe')).toThrow(/true or false/)
    expect(coerceAnswer(questions[1]!, '')).toBe(true)
    expect(coerceAnswer(questions[1]!, 'no')).toBe(false)
  })

  it('prompts through the given prompter when interactive, flags still win', async () => {
    const prompt = {
      select: vi.fn(async () => 'redis'),
      confirm: vi.fn(async () => false),
      multiselect: vi.fn(async () => ['ios']),
      text: vi.fn(async () => '5000'),
    }
    const answers = await resolveAnswers(questions, { port: '4000' }, info(), {
      interactive: true,
      prompt,
    })
    expect(answers).toEqual({ driver: 'redis', worker: false, targets: ['ios'], port: '4000' })
    expect(prompt.text).not.toHaveBeenCalled()
  })

  it('describes every question as a flag for --help', () => {
    const lines = describeQuestions(questions)
    expect(lines[0]).toMatch(
      /^--driver <memory\|redis>\s+Where do jobs queue\? \(default: memory\)/,
    )
    expect(lines[1]).toMatch(/^--worker \/ --no-worker/)
    expect(lines[2]).toMatch(/^--targets a,b/)
  })
})

describe('add context', () => {
  it('edits the wiring files idempotently: provider, config, scripts, env, agents, tsconfig', () => {
    quiet()
    const dir = project({
      'package.json': pkg,
      'kitrrc.ts': rc,
      'tsconfig.json': JSON.stringify({ compilerOptions: { types: ['node'] }, include: ['app'] }),
      '.env.example': '',
    })
    const ctx = createContext({ root: dir })
    const codemods = new Codemods(ctx)
    const add = createAddContext(ctx, codemods, { worker: false })
    expect(add.answers.worker).toBe(false)
    expect(add.hasPackage('server')).toBe(true)
    expect(add.hasPackage('@kitr/server')).toBe(true)
    expect(add.hasPackage('jobs')).toBe(false)
    expect(add.has('kitr')).toBe(true)
    add.deps.add('ioredis')
    expect(add.has('ioredis')).toBe(true)
    for (let i = 0; i < 2; i++) {
      add.provider.add('@kitr/jobs/provider')
      add.config('jobs', 'export default {}\n')
      add.scripts.add('worker', 'kitr jobs:work')
      add.env.add({ REDIS_URL: 'redis://localhost' })
      add.agents.add('jobs', '- jobs notes')
      add.tsconfig.addTypes('vite/client', 'node')
      add.tsconfig.addInclude('server')
      add.tsconfig.addPaths({ '#server/*': ['./server/*'] })
      add.tsconfig.set('jsx', 'react-jsx')
    }
    const read = (f: string) => readFileSync(join(dir, f), 'utf8')
    expect(read('kitrrc.ts').match(/@kitr\/jobs\/provider/g)).toHaveLength(1)
    expect(read('config/jobs.ts')).toBe('export default {}\n')
    expect(JSON.parse(read('package.json')).scripts.worker).toBe('kitr jobs:work')
    expect(read('.env.example').match(/REDIS_URL=/g)).toHaveLength(1)
    expect(read('AGENTS.md').match(/## kitr: jobs/g)).toHaveLength(1)
    const ts = JSON.parse(read('tsconfig.json'))
    expect(ts.compilerOptions.types).toEqual(['node', 'vite/client'])
    expect(ts.include).toEqual(['app', 'server'])
    expect(ts.compilerOptions.paths).toEqual({ '#server/*': ['./server/*'] })
    expect(ts.compilerOptions.jsx).toBe('react-jsx')

    add.provider.remove('@kitr/jobs/provider')
    add.scripts.remove('worker', 'kitr jobs:work')
    add.agents.remove('jobs')
    add.tsconfig.removeTypes('vite/client')
    expect(read('kitrrc.ts')).not.toContain('@kitr/jobs/provider')
    expect(JSON.parse(read('package.json')).scripts.worker).toBeUndefined()
    expect(read('AGENTS.md')).not.toContain('## kitr: jobs')
    expect(JSON.parse(read('tsconfig.json')).compilerOptions.types).toEqual(['node'])
  })

  it('extends the route table, creating it when missing, and removes an extension again', () => {
    quiet()
    const dir = project({ 'package.json': pkg, 'kitrrc.ts': rc })
    const ctx = createContext({ root: dir })
    const codemods = new Codemods(ctx)
    const add = createAddContext(ctx, codemods, {})
    add.routes.extend('@kitr/api/routes')
    add.routes.extend('@kitr/api/routes')
    add.routes.extend('@kitr/realtime/routes')
    const read = () => readFileSync(join(dir, 'app/routes.ts'), 'utf8')
    expect(read()).toContain("import apiRoutes from '@kitr/api/routes'")
    expect(read()).toContain("import realtimeRoutes from '@kitr/realtime/routes'")
    expect(read()).toMatch(/defineRoutes\(\[apiRoutes, realtimeRoutes\]/)
    expect(read().match(/apiRoutes/g)).toHaveLength(2)
    add.routes.remove('@kitr/api/routes')
    expect(read()).not.toContain('apiRoutes')
    expect(read()).toMatch(/defineRoutes\(\[realtimeRoutes\]/)
  })

  it('honours directories.routeTable and edits an existing table the app wrote', () => {
    quiet()
    const dir = project({
      'package.json': pkg,
      'kitrrc.ts': rc.replace(
        "server: 'server'",
        "server: 'server', routeTable: 'server/routes.ts'",
      ),
      'server/routes.ts': `import { defineRoutes } from 'kitr/app'\n\nexport const routes = defineRoutes([], (r) => r.group('/api', (api) => api))\n`,
    })
    const ctx = createContext({ root: dir })
    createAddContext(ctx, new Codemods(ctx), {}).routes.extend('@acme/sockets/routes')
    const src = readFileSync(join(dir, 'server/routes.ts'), 'utf8')
    expect(src).toContain("import socketsRoutes from '@acme/sockets/routes'")
    expect(src).toMatch(/defineRoutes\(\[socketsRoutes\], \(r\) => r\.group/)
  })

  it('derives readable local names for extension imports', () => {
    expect(extensionLocalName('@kitr/api/routes')).toBe('apiRoutes')
    expect(extensionLocalName('@acme/sockets/routes')).toBe('socketsRoutes')
    expect(extensionLocalName('my-router')).toBe('myRouter')
    expect(extensionLocalName('@scope/x')).toBe('x')
  })
})

describe('plan', () => {
  // Setup modules resolve from the running CLI's package: the kitr bin, which depends on every
  // official package. Point argv there, as it is when the CLI runs for real.
  const argv1 = process.argv[1]
  beforeAll(() => {
    process.argv[1] = join(import.meta.dirname, '../../kitr/bin/kitr.mjs')
  })
  afterAll(() => {
    process.argv[1] = argv1!
  })

  it('orders setup modules by requires, skipping what is installed', async () => {
    const dir = project({ 'package.json': pkg, 'kitrrc.ts': rc })
    const ctx = createContext({ root: dir })
    const plan = await resolvePlan(ctx, ['jobs'], ['@kitr/server'], { install: false })
    expect(plan.map((s) => s.name)).toEqual(['jobs'])
    expect(plan[0]!.loaded.package).toBe('@kitr/jobs')
    const fresh = await resolvePlan(ctx, ['jobs'], [], { install: false })
    expect(fresh.map((s) => [s.name, s.loaded.package])).toEqual([
      ['logger', '@kitr/logger'],
      ['server', '@kitr/server'],
      ['jobs', '@kitr/jobs'],
    ])
  })

  it('tells a platform package from the rest', async () => {
    const dir = project({ 'package.json': pkg, 'kitrrc.ts': rc })
    const ctx = createContext({ root: dir })
    const plan = await resolvePlan(ctx, ['tauri'], ['@kitr/router', '@kitr/storage'], {
      install: false,
    })
    expect(plan.map((s) => [s.name, s.loaded.definition.kind ?? 'package'])).toEqual([
      ['react', 'package'],
      ['platform', 'package'],
      ['tauri', 'platform'],
    ])
  })

  it('rejects an unknown package with the known names', async () => {
    const dir = project({ 'package.json': pkg, 'kitrrc.ts': rc })
    const ctx = createContext({ root: dir })
    await expect(resolvePlan(ctx, ['nope'], [], { install: false })).rejects.toThrow(
      /Unknown package "nope"/,
    )
  })
})
