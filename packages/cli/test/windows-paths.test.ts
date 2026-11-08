import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The CLI on Windows, from a Linux runner: `node:path` is `path.win32` for the modules under test,
 * `process.platform` says `win32`, and no file exists. Dry runs and path arithmetic need nothing
 * else, and they are where a backslash would leak into a log line, a generated import or a glob.
 */
vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path')
  return { ...actual.win32, default: actual.win32, win32: actual.win32, posix: actual.posix }
})
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return { ...actual, existsSync: () => false }
})

const { createContext, projectBin } = await import('../src/context')
const { createPlatformContext } = await import('../src/platforms')
const { createGenerateContext, GENERATED_DIR } = await import('../src/types')
const { relativeImport } = await import('../src/codemods')
const { definePlatform } = await import('@kitr/core')
const fake = definePlatform({ type: 'fake', describe: {} }, () => ({}))

const root = 'C:\\Users\\dev\\shop'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** Drop the colour codes the logger adds. */
const plain = (text: string) =>
  text.replace(new RegExp(`${String.fromCharCode(27)}\\[\\d+m`, 'g'), '')

const logged = () => {
  const lines: string[] = []
  vi.spyOn(console, 'log').mockImplementation((...a) => void lines.push(a.join(' ')))
  return lines
}

describe('paths with Windows separators', () => {
  it('joins project paths with backslashes and writes log lines with forward slashes', () => {
    const lines = logged()
    const ctx = createContext({ root, dryRun: true })
    expect(ctx.root).toBe(root)
    expect(ctx.path('app', 'routes.ts')).toBe('C:\\Users\\dev\\shop\\app\\routes.ts')
    expect(ctx.write('app\\pages\\home.tsx', 'x')).toBe(true)
    expect(ctx.write('app/pages/about.tsx', 'x')).toBe(true)
    expect(lines.map((l) => plain(l))).toEqual([
      '→ would write app/pages/home.tsx',
      '→ would write app/pages/about.tsx',
    ])
  })

  it('platform contexts resolve under the platforms directory and log forward slashes', () => {
    const lines = logged()
    const project = createContext({ root, dryRun: true })
    const instance = fake()
    const platform = createPlatformContext(project, 'site', instance, { platforms: [instance] })
    expect(platform.dir('src-tauri', 'icons')).toBe(
      'C:\\Users\\dev\\shop\\platforms\\site\\src-tauri\\icons',
    )
    expect(platform.exists('package.json')).toBe(false)
    expect(platform.write('platforms\\site\\README.md', '#')).toBe(true)
    expect(plain(lines.join('\n'))).toContain('would write platforms/site/README.md')
  })

  it('generated imports are relative with forward slashes, from the .kitr directory', () => {
    const project = createContext({ root })
    const generate = createGenerateContext(project)
    expect(GENERATED_DIR).toBe('.kitr')
    expect(generate.importPath('app\\routes.ts')).toBe('../app/routes')
    expect(generate.importPath('server/main.tsx')).toBe('../server/main')
    expect(generate.importPath('.kitr/actions.ts')).toBe('./actions')
  })

  it('relative imports between project files never contain a backslash', () => {
    expect(relativeImport('server/main.ts', 'server/routes.ts')).toBe('./routes')
    expect(relativeImport('app/pages/home.tsx', 'app/routes.ts')).toBe('../routes')
  })

  it('finds the shim that runs on Windows', () => {
    vi.stubGlobal('process', Object.create(process, { platform: { value: 'win32' } }))
    expect(projectBin(root, 'biome')).toBe('C:\\Users\\dev\\shop\\node_modules\\.bin\\biome.cmd')
  })

  it('finds the plain binary elsewhere', () => {
    vi.stubGlobal('process', Object.create(process, { platform: { value: 'linux' } }))
    expect(projectBin(root, 'biome')).toBe('C:\\Users\\dev\\shop\\node_modules\\.bin\\biome')
  })
})
