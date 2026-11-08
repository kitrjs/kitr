import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { PassThrough } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { definePlatform } from '@kitr/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createContext } from '../src/context'
import {
  createPlatformContext,
  literal,
  loadPlatforms,
  parseFlags,
  pipeLines,
  platformPrefix,
  removeRcPlatform,
  resolvePlatformType,
  runPlatforms,
  selectPlatforms,
  setRcPlatformOption,
  withFlags,
  writeRcPlatform,
} from '../src/platforms'

const coreEntry = pathToFileURL(resolve(__dirname, '../../core/dist/index.js')).href

/**
 * A project whose kitrrc.ts defines its own platform. Every hook appends a JSON line to
 * calls.log, so tests can see which platform ran, with which options, flags and env.
 */
const fakePlatform = `import { definePlatform } from '${coreEntry}'
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'

export const fake = definePlatform(
  {
    type: 'fake',
    describe: {
      port: { description: 'Port', type: 'number', default: 3000 },
      mode: { description: 'Mode', type: 'string', values: ['spa', 'ssr'], default: 'spa' },
      open: { description: 'Open a browser', type: 'boolean', default: false },
      targets: { description: 'Targets', type: 'list' },
    },
  },
  (options) => {
    const record = (hook) => async (ctx) => {
      if (ctx.flags.fail === hook) throw new Error(ctx.name + ' ' + hook + ' failed')
      if (ctx.flags.delay) await new Promise((r) => setTimeout(r, Number(ctx.flags.delay)))
      appendFileSync(
        join(ctx.root, 'calls.log'),
        JSON.stringify({
          hook,
          name: ctx.name,
          options,
          flags: ctx.flags,
          env: ctx.env.KITR_PLATFORM,
          platforms: ctx.platforms.map((p) => p.type),
        }) + '\\n',
      )
    }
    return { dev: record('dev'), build: record('build'), scaffold: record('scaffold') }
  },
)
`

const rc = (platforms: string) => `import { fake } from './fake-platform'

export default {
  packages: [],
  providers: [],
  platforms: {
${platforms}
  },
}
`

const dirs: string[] = []
function project(
  platforms = `    site: fake({ mode: 'ssr' }),\n    'my-app': fake({ port: 4000 }),`,
) {
  const dir = mkdtempSync(join(tmpdir(), 'kitr-platforms-'))
  dirs.push(dir)
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'p', type: 'module' }))
  writeFileSync(join(dir, 'fake-platform.ts'), fakePlatform)
  writeFileSync(join(dir, 'kitrrc.ts'), rc(platforms))
  return dir
}
const calls = (dir: string) => {
  try {
    return readFileSync(join(dir, 'calls.log'), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l))
  } catch {
    return []
  }
}
const quiet = () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('parseFlags', () => {
  it('splits words from flags in every spelling', () => {
    expect(
      parseFlags(['site', 'api', '--port', '4000', '--mode=ssr', '--no-open', '--watch']),
    ).toEqual({
      words: ['site', 'api'],
      flags: { port: '4000', mode: 'ssr', open: false, watch: true },
    })
  })

  it('treats a flag followed by another flag as boolean', () => {
    expect(parseFlags(['--verbose', '--port', '1'])).toEqual({
      words: [],
      flags: { verbose: true, port: '1' },
    })
  })

  it('keeps an empty value after =', () => {
    expect(parseFlags(['--host=']).flags).toEqual({ host: '' })
  })
})

describe('literal', () => {
  it('prints options as source with single quotes and bare keys', () => {
    expect(literal({ mode: 'ssr', port: 3000, pwa: true })).toBe(
      "{ mode: 'ssr', port: 3000, pwa: true }",
    )
    expect(literal({ targets: ['ios', 'android'], nested: { a: 1 } })).toBe(
      "{ targets: ['ios', 'android'], nested: { a: 1 } }",
    )
  })

  it('quotes keys that are not identifiers, escapes quotes and drops undefined', () => {
    expect(literal({ 'base-url': "it's", skip: undefined })).toBe("{ 'base-url': 'it\\'s' }")
    expect(literal({})).toBe('{}')
  })
})

describe('loadPlatforms', () => {
  it('executes kitrrc.ts and returns validated instances with defaults', async () => {
    const ctx = createContext({ root: project() })
    const all = await loadPlatforms(ctx, {})
    expect(Object.keys(all)).toEqual(['site', 'my-app'])
    expect(all.site!.options).toEqual({ mode: 'ssr', port: 3000, open: false })
    expect(all['my-app']!.options).toMatchObject({ port: 4000, mode: 'spa' })
  })

  it('applies KITR_<NAME>_<OPTION> env overrides with the option types', async () => {
    const ctx = createContext({ root: project() })
    const all = await loadPlatforms(ctx, {
      KITR_SITE_PORT: '5000',
      KITR_SITE_OPEN: 'true',
      KITR_SITE_TARGETS: 'ios, android',
      // Names with dashes become underscores.
      KITR_MY_APP_MODE: 'ssr',
      // Unknown options are ignored rather than guessed.
      KITR_SITE_NOPE: 'x',
    })
    expect(all.site!.options).toMatchObject({
      port: 5000,
      open: true,
      targets: ['ios', 'android'],
    })
    expect(all.site!.options).not.toHaveProperty('nope')
    expect(all['my-app']!.options).toMatchObject({ mode: 'ssr', port: 4000 })
  })

  it('rejects env overrides that do not fit the option', async () => {
    const ctx = createContext({ root: project() })
    await expect(loadPlatforms(ctx, { KITR_SITE_PORT: 'abc' })).rejects.toThrow(/expected a number/)
    await expect(loadPlatforms(ctx, { KITR_SITE_MODE: 'fast' })).rejects.toThrow(/one of spa, ssr/)
    await expect(loadPlatforms(ctx, { KITR_SITE_OPEN: 'maybe' })).rejects.toThrow(/true or false/)
  })

  it('names the entry that is not a platform', async () => {
    const ctx = createContext({ root: project(`    site: { type: 'web' },`) })
    await expect(loadPlatforms(ctx, {})).rejects.toThrow(/platforms\.site is not a platform/)
  })

  it('returns nothing without a kitrrc.ts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kitr-platforms-'))
    dirs.push(dir)
    writeFileSync(join(dir, 'package.json'), '{}')
    expect(await loadPlatforms(createContext({ root: dir }), {})).toEqual({})
  })
})

describe('selectPlatforms and withFlags', () => {
  const fake = definePlatform(
    { type: 'fake', describe: { port: { description: '', type: 'number', default: 1 } } },
    () => ({}),
  )
  const all = { site: fake(), api: fake({ port: 2 }) }

  it('selects every platform, or the named ones in the order given', () => {
    expect(selectPlatforms(all, []).map(([n]) => n)).toEqual(['site', 'api'])
    expect(selectPlatforms(all, ['api', 'site']).map(([n]) => n)).toEqual(['api', 'site'])
  })

  it('explains an empty config and an unknown name', () => {
    expect(() => selectPlatforms({}, [])).toThrow(/kitr add <type> <name>/)
    expect(() => selectPlatforms(all, ['web'])).toThrow(/No platform named "web".*site, api/)
  })

  it('coerces known flags into options and passes the rest through', () => {
    const { instance, flags } = withFlags(all.site, { port: '8080', target: 'ios' })
    expect(instance.options.port).toBe(8080)
    expect(flags).toEqual({ port: 8080, target: 'ios' })
    expect(withFlags(all.site, {}).instance).toBe(all.site)
    expect(() => withFlags(all.site, { port: 'x' })).toThrow(/expected a number/)
  })
})

describe('runPlatforms', () => {
  it('runs a hook for every platform with its own name, options and env', async () => {
    quiet()
    const dir = project()
    await runPlatforms(createContext({ root: dir }), 'dev', [])
    const log = calls(dir)
    expect(log.map((c) => c.name).sort()).toEqual(['my-app', 'site'])
    for (const c of log) {
      expect(c.hook).toBe('dev')
      expect(c.env).toBe(c.name)
      expect(c.platforms).toEqual(['fake', 'fake'])
    }
    expect(log.find((c) => c.name === 'site').options.mode).toBe('ssr')
  })

  it('runs only the named platforms, with flags applied to each', async () => {
    quiet()
    const dir = project()
    await runPlatforms(createContext({ root: dir }), 'dev', ['site'], { port: '9000', x: 'y' })
    expect(calls(dir)).toMatchObject([
      { name: 'site', options: { port: 9000, mode: 'ssr' }, flags: { port: 9000, x: 'y' } },
    ])
  })

  it('builds one platform at a time, in kitrrc.ts order', async () => {
    quiet()
    const dir = project()
    await runPlatforms(createContext({ root: dir }), 'build', ['site', 'my-app'], {})
    expect(calls(dir).map((c) => c.name)).toEqual(['site', 'my-app'])
  })

  it('runs dev in parallel', async () => {
    quiet()
    const dir = project(`    slow: fake(),\n    fast: fake(),`)
    const ctx = createContext({ root: dir })
    // Same delay for both; parallel means the total is about one delay, not two.
    const started = Date.now()
    await runPlatforms(ctx, 'dev', [], { delay: '300' })
    expect(Date.now() - started).toBeLessThan(550)
    expect(calls(dir)).toHaveLength(2)
  })

  it('skips a platform without the hook and reports it', async () => {
    const lines: string[] = []
    vi.spyOn(console, 'log').mockImplementation((m) => lines.push(String(m)))
    const dir = project()
    await runPlatforms(createContext({ root: dir }), 'start', [])
    expect(calls(dir)).toEqual([])
    expect(lines.join('\n')).toMatch(/site: the fake platform has no start step/)
  })

  it('fails with the platform error and stops a sequential build', async () => {
    quiet()
    const dir = project()
    await expect(
      runPlatforms(createContext({ root: dir }), 'build', [], { fail: 'build' }),
    ).rejects.toThrow(/site build failed/)
    expect(calls(dir)).toEqual([])
  })

  it('removes its signal listeners when done', async () => {
    quiet()
    const before = process.listenerCount('SIGINT')
    await runPlatforms(createContext({ root: project() }), 'dev', [])
    await runPlatforms(createContext({ root: project() }), 'build', [], { fail: 'build' }).catch(
      () => {},
    )
    expect(process.listenerCount('SIGINT')).toBe(before)
  })

  it('rejects an unknown name before running anything', async () => {
    quiet()
    const dir = project()
    await expect(runPlatforms(createContext({ root: dir }), 'dev', ['nope'])).rejects.toThrow(
      /No platform named "nope"/,
    )
    expect(calls(dir)).toEqual([])
  })
})

describe('kitrrc.ts edits', () => {
  const base = `import { defineKitrConfig } from 'kitr/app'

export default defineKitrConfig({
  packages: ['@kitr/react'],
  providers: [],
})
`
  const web = { entry: '@kitr/web', factory: 'web' }
  const server = { entry: '@kitr/server', factory: 'server' }
  function rcProject(source = base) {
    const dir = mkdtempSync(join(tmpdir(), 'kitr-platforms-'))
    dirs.push(dir)
    writeFileSync(join(dir, 'package.json'), '{}')
    writeFileSync(join(dir, 'kitrrc.ts'), source)
    return {
      dir,
      ctx: createContext({ root: dir }),
      read: () => readFileSync(join(dir, 'kitrrc.ts'), 'utf8'),
    }
  }

  it('adds a platform with its import once, and replaces it on a second add', () => {
    const { ctx, read } = rcProject()
    writeRcPlatform(ctx, 'site', web, { mode: 'ssr' })
    writeRcPlatform(ctx, 'admin', web, {})
    writeRcPlatform(ctx, 'site', web, { mode: 'static', port: 4000 })
    const src = read()
    expect(src.match(/import \{ web \} from '@kitr\/web'/g)).toHaveLength(1)
    expect(src).toMatch(/site: web\(\{ mode: 'static', port: 4000 \}\)/)
    expect(src).toMatch(/admin: web\(\)/)
    expect(src).toContain("packages: ['@kitr/react']")
    expect(ctx.readRc().platforms).toMatchObject({ site: {}, admin: {} })
  })

  it('sets, changes and unsets one option', () => {
    const { ctx, read } = rcProject()
    writeRcPlatform(ctx, 'api', server, {})
    setRcPlatformOption(ctx, 'api', 'port', 8080)
    expect(read()).toMatch(/api: server\(\{\s*port: 8080,?\s*\}\)/)
    setRcPlatformOption(ctx, 'api', 'runtime', 'bun')
    setRcPlatformOption(ctx, 'api', 'port', 9090)
    expect(read()).toMatch(/port: 9090/)
    expect(read()).toMatch(/runtime: 'bun'/)
    setRcPlatformOption(ctx, 'api', 'port', undefined)
    expect(read()).not.toMatch(/port:/)
    expect(() => setRcPlatformOption(ctx, 'nope', 'port', 1)).toThrow(/not a factory call/)
  })

  it('removes a platform and leaves the rest', () => {
    const { ctx, read } = rcProject()
    writeRcPlatform(ctx, 'site', web, {})
    writeRcPlatform(ctx, 'api', server, {})
    removeRcPlatform(ctx, 'site')
    expect(read()).not.toMatch(/site:/)
    expect(read()).toMatch(/api: server\(\)/)
  })

  it('drops the factory import with the last platform that calls it', () => {
    const { ctx, read } = rcProject()
    writeRcPlatform(ctx, 'site', web, {})
    writeRcPlatform(ctx, 'admin', web, {})
    expect(removeRcPlatform(ctx, 'site')).toBeUndefined()
    expect(read()).toMatch(/import \{ web \} from '@kitr\/web'/)
    expect(removeRcPlatform(ctx, 'admin')).toBe('web')
    expect(read()).not.toMatch(/@kitr\/web/)
  })

  it('creates kitrrc.ts when there is none', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kitr-platforms-'))
    dirs.push(dir)
    writeFileSync(join(dir, 'package.json'), '{}')
    quiet()
    const ctx = createContext({ root: dir })
    writeRcPlatform(ctx, 'site', web, { mode: 'spa' })
    const src = readFileSync(join(dir, 'kitrrc.ts'), 'utf8')
    expect(src).toContain("import { web } from '@kitr/web'")
    expect(src).toMatch(/site: web\(\{ mode: 'spa' \}\)/)
  })

  it('refuses an rc without a default export object, and unknown types', async () => {
    const { ctx } = rcProject(`export const x = 1\n`)
    expect(() => writeRcPlatform(ctx, 'site', web, {})).toThrow(/expected `export default/)
    await expect(resolvePlatformType(ctx, 'nope')).rejects.toThrow(/not a platform type/)
  })
})

describe('createPlatformContext', () => {
  const fake = definePlatform({ type: 'fake' }, () => ({}))
  function setup(dryRun = false) {
    const dir = mkdtempSync(join(tmpdir(), 'kitr-platforms-'))
    dirs.push(dir)
    writeFileSync(join(dir, 'package.json'), '{}')
    writeFileSync(
      join(dir, 'kitrrc.ts'),
      `export default { packages: [], providers: [], directories: { platforms: 'targets' } }\n`,
    )
    const ctx = createContext({ root: dir, dryRun })
    return { dir, pctx: createPlatformContext(ctx, 'phone', fake(), { platforms: [] }) }
  }

  it('resolves dir() under the configured platforms directory', () => {
    const { dir, pctx } = setup()
    expect(pctx.dir('ios', 'App')).toBe(join(dir, 'targets', 'phone', 'ios', 'App'))
  })

  it('writes once, overwrites only when asked, and writes nothing in a dry run', () => {
    quiet()
    const { dir, pctx } = setup()
    expect(pctx.write('platforms/phone/a.txt', 'one')).toBe(true)
    expect(pctx.write('platforms/phone/a.txt', 'two')).toBe(false)
    expect(pctx.read('platforms/phone/a.txt')).toBe('one')
    expect(pctx.write('platforms/phone/a.txt', 'three', { overwrite: true })).toBe(true)
    expect(readFileSync(join(dir, 'platforms/phone/a.txt'), 'utf8')).toBe('three')

    const dry = setup(true)
    expect(dry.pctx.write('x.txt', 'x')).toBe(true)
    expect(dry.pctx.exists('x.txt')).toBe(false)
  })

  it('runs commands with KITR_PLATFORM set and rejects on a failing exit code', async () => {
    const { dir, pctx } = setup()
    mkdirSync(join(dir, 'out'))
    await pctx.run(
      process.execPath,
      [
        '-e',
        `require('fs').writeFileSync('out/env', process.env.KITR_PLATFORM + ':' + process.env.EXTRA)`,
      ],
      { env: { EXTRA: 'yes' } },
    )
    expect(readFileSync(join(dir, 'out/env'), 'utf8')).toBe('phone:yes')
    await expect(pctx.run(process.execPath, ['-e', 'process.exit(3)'])).rejects.toThrow(
      /exited with code 3/,
    )
  })

  it('treats an abort as a clean stop, not a failure', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kitr-platforms-'))
    dirs.push(dir)
    writeFileSync(join(dir, 'package.json'), '{}')
    const controller = new AbortController()
    const pctx = createPlatformContext(createContext({ root: dir }), 'site', fake(), {
      platforms: [],
      signal: controller.signal,
    })
    const running = pctx.run(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'])
    setTimeout(() => controller.abort(), 100)
    await expect(running).resolves.toBeUndefined()
    // Already aborted: nothing is spawned.
    await expect(pctx.run(process.execPath, ['-e', 'process.exit(1)'])).resolves.toBeUndefined()
  })
})

describe('platform output prefixes', () => {
  it('labels every line a platform prints, joining chunks and flushing the last line', async () => {
    const out: string[] = []
    const source = new PassThrough()
    pipeLines(source, { write: (chunk) => out.push(chunk) }, (line) => `[site] ${line}`)
    source.write('ready in 3')
    source.write('00ms\nlocal: http://localhost:3000\r\nlast')
    const ended = new Promise((done) => source.on('end', done))
    source.end()
    await ended
    expect(out.join('')).toBe(
      '[site] ready in 300ms\n[site] local: http://localhost:3000\n[site] last\n',
    )
  })

  it('wraps the name in brackets, in a colour per platform', () => {
    const line = platformPrefix('api', 1)('listening')
    expect(line).toContain('[api]')
    expect(line.endsWith(' listening')).toBe(true)
  })

  it('runs a platform process through the prefix when the context has one', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kitr-platforms-'))
    dirs.push(dir)
    writeFileSync(join(dir, 'package.json'), '{}')
    const lines: string[] = []
    const write = process.stdout.write.bind(process.stdout)
    process.stdout.write = ((chunk: string) => {
      lines.push(String(chunk))
      return true
    }) as typeof process.stdout.write
    try {
      const pctx = createPlatformContext(
        createContext({ root: dir }),
        'api',
        definePlatform({ type: 'fake' }, () => ({}))(),
        {
          platforms: [],
          prefix: (line) => `[api] ${line}`,
        },
      )
      await pctx.run(process.execPath, ['-e', "console.log('one'); console.log('two')"])
    } finally {
      process.stdout.write = write
    }
    expect(lines.join('')).toBe('[api] one\n[api] two\n')
  })
})
