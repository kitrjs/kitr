import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineTypes } from '@kitr/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Codemods } from '../src/codemods'
import { createContext } from '../src/context'
import {
  createGenerateContext,
  generatorsFor,
  loadGenerators,
  platformsGenerator,
  renderPlatforms,
  runTypes,
  watchGlobsOf,
} from '../src/types'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kitr-types-'))
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'app', scripts: { typecheck: 'tsc --noEmit' } }),
  )
  writeFileSync(
    join(dir, 'kitrrc.ts'),
    `import { defineKitrConfig } from 'kitr/app'
import { web } from '@kitr/web'
import { server } from '@kitr/server'
export default defineKitrConfig({
  packages: [],
  providers: [],
  platforms: { site: web({ mode: 'ssr', port: 3000 }), api: server() },
})
`,
  )
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const silent = () => createContext({ root: dir })

describe('platforms generator', () => {
  it('renders the KitrPlatforms augmentation from kitrrc.ts', () => {
    const out = renderPlatforms({
      site: { factory: 'web', options: { mode: 'ssr', port: 3000 } },
      api: { factory: 'server' },
    })
    expect(out).toContain("declare module '@kitr/core'")
    expect(out).toContain("api: { type: 'server'; options: {} }")
    expect(out).toContain("site: { type: 'web'; options: { mode: 'ssr', port: 3000 } }")
    expect(out).toContain("readonly KITR_PLATFORM: 'api' | 'site'")
    expect(out).toContain("readonly KITR_PLATFORM_TYPE: 'server' | 'web'")
    expect(platformsGenerator.watch).toContain('kitrrc.ts')
  })

  it('types import.meta.env only when there are platforms', () => {
    expect(renderPlatforms({})).not.toContain('ImportMetaEnv')
  })

  it('is always loaded, even with no packages', async () => {
    const generators = await loadGenerators(silent())
    expect(generators.map((g) => g.name)).toEqual(['platforms'])
  })

  it("loads a package's generator through its setup module's types hook", async () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'app', dependencies: { '@kitr/actions': '*', '@kitr/query': '*' } }),
    )
    const generators = await loadGenerators(silent())
    expect(generators.map((g) => g.name)).toEqual(['platforms', 'actions'])
  })
})

describe('runTypes', () => {
  it('writes .kitr/platforms.d.ts, then reports it unchanged, then stale under --check', async () => {
    const ctx = silent()
    const first = await runTypes(ctx, { quiet: true })
    expect(first.written).toEqual(['.kitr/platforms.d.ts'])
    expect(readFileSync(join(dir, '.kitr/platforms.d.ts'), 'utf8')).toContain("site: { type: 'web'")
    const second = await runTypes(ctx, { quiet: true })
    expect(second.written).toEqual([])
    expect(second.unchanged).toEqual(['.kitr/platforms.d.ts'])
    writeFileSync(
      join(dir, 'kitrrc.ts'),
      readFileSync(join(dir, 'kitrrc.ts'), 'utf8').replace('api: server()', ''),
    )
    const check = await runTypes(ctx, { check: true, quiet: true })
    expect(check.stale).toEqual(['.kitr/platforms.d.ts'])
    expect(readFileSync(join(dir, '.kitr/platforms.d.ts'), 'utf8')).toContain('api')
  })

  it('runs the given generators, only the selected ones, and names a failing one', async () => {
    const ctx = silent()
    const seen: string[] = []
    const a = defineTypes({
      name: 'a',
      watch: ['app/a/**/*.ts'],
      generate: (g) => {
        seen.push(...g.glob('app', '**/*.ts'))
        return [{ file: 'a.ts', content: 'export const a = 1\n' }]
      },
    })
    const b = defineTypes({
      name: 'b',
      watch: (rc) => [`${rc.directories.app}/b/*.ts`],
      generate: () => {
        throw new Error('boom')
      },
    })
    mkdirSync(join(dir, 'app/a'), { recursive: true })
    writeFileSync(join(dir, 'app/a/one.ts'), '')
    writeFileSync(join(dir, 'app/a/one.test.ts'), '')
    const result = await runTypes(ctx, { only: ['a'], quiet: true }, [a, b])
    expect(result.generators).toEqual(['a'])
    expect(result.written).toEqual(['.kitr/a.ts'])
    expect(seen).toEqual(['app/a/one.test.ts', 'app/a/one.ts'])
    await expect(runTypes(ctx, { quiet: true }, [a, b])).rejects.toThrow(
      /the b generator failed: boom/,
    )
    const rc = ctx.readRc()
    expect(watchGlobsOf([a, b], rc)).toEqual(['app/a/**/*.ts', 'app/b/*.ts'])
    expect(generatorsFor([a, b], rc, 'app/b/x.ts').map((g) => g.name)).toEqual(['b'])
    expect(generatorsFor([a, b], rc, 'app/a/deep/x.ts').map((g) => g.name)).toEqual(['a'])
    expect(generatorsFor([a, b], rc, 'app/c.ts')).toEqual([])
  })

  it('gives generators import paths that reach project files from .kitr/', () => {
    const g = createGenerateContext(silent())
    expect(g.importPath('app/actions/projects.ts')).toBe('../app/actions/projects')
    expect(g.importPath('kitrrc.ts')).toBe('../kitrrc')
    expect(g.exists('kitrrc.ts')).toBe(true)
    expect(g.rc.platforms.site?.factory).toBe('web')
  })
})

describe('kitr add actions codemods', () => {
  it('enables generated types once and wires operations into app/app.ts', () => {
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { paths: { '#app/*': ['./app/*'] } }, include: ['app'] }),
    )
    writeFileSync(join(dir, '.gitignore'), 'node_modules\n')
    mkdirSync(join(dir, 'app'))
    writeFileSync(
      join(dir, 'app/app.ts'),
      `import { createApp } from 'kitr/app'\nimport { env } from './env'\n\nexport const app = createApp({ providers, config, env })\n`,
    )
    const ctx = silent()
    const c = new Codemods(ctx)
    c.enableGeneratedTypes()
    c.enableGeneratedTypes()
    const ts = JSON.parse(readFileSync(join(dir, 'tsconfig.json'), 'utf8'))
    expect(ts.compilerOptions.paths['#kitr/*']).toEqual(['./.kitr/*'])
    expect(ts.include).toEqual(['app', '.kitr/**/*'])
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe('node_modules\n.kitr\n')
    expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).scripts.typecheck).toBe(
      'kitr types && tsc --noEmit',
    )
    c.registerAppOption('operations', '#kitr/actions')
    c.registerAppOption('operations', '#kitr/actions')
    const app = readFileSync(join(dir, 'app/app.ts'), 'utf8')
    expect(app).toBe(
      `import { createApp } from 'kitr/app'\nimport { env } from './env'\nimport { operations } from '#kitr/actions'\n\nexport const app = createApp({ operations, providers, config, env })\n`,
    )
    c.unregisterAppOption('operations', '#kitr/actions')
    expect(readFileSync(join(dir, 'app/app.ts'), 'utf8')).toBe(
      `import { createApp } from 'kitr/app'\nimport { env } from './env'\n\nexport const app = createApp({ providers, config, env })\n`,
    )
  })
})
