import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { cpus, loadavg } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * The route table must keep exact types at app scale. Every `.page()`, `.get()`, `.group()` and
 * `.merge()` extends one accumulated map; a per-step type that re-walks the whole map hits TS2589
 * ("excessively deep") at about 50 pages or 60 endpoints and the router degrades to `any`.
 *
 * This generates three fixtures (300 pages in one chain, 300 endpoints in one `group('/api')`, three
 * sub-tables of 100 joined with `.merge()`), each with `expectTypeOf` assertions on keys, params and
 * output, and type-checks them with `tsc --extendedDiagnostics` against the built packages
 * (`pnpm build` first). Any error, TS2589 included, or a check time over the budget fails.
 */

const root = fileURLToPath(new URL('../../..', import.meta.url))
const dir = join(dirname(fileURLToPath(import.meta.url)), '.type-perf')
const BUDGET_SECONDS = 10
const MAX_INSTANTIATIONS = 3_000_000
const N = 300

const header = `import { defineRoutes } from '@kitr/core'
import { expectTypeOf } from 'vitest'

type Has<Keys, Key extends string> = Key extends Keys ? true : false
type IsExactKeys<Keys> = string extends Keys ? false : true
`

const pageChain = (prefix: string, count: number) =>
  Array.from(
    { length: count },
    (_, i) => `    .page('/${prefix}${i}/$id', { component: Page })`,
  ).join('\n')

const endpointChain = (prefix: string, count: number) =>
  Array.from(
    { length: count },
    (_, i) =>
      `      .get('/${prefix}${i}/:id', (ctx) => ({ n: ${i}, id: ctx.params.id }), { name: '${prefix}${i}' })`,
  ).join('\n')

const fixtures: Record<string, string> = {
  'pages.ts': `${header}import pages from '@kitr/router/routes'

declare const Page: () => null

export const routes = defineRoutes([pages], (r) =>
  r
${pageChain('p', N)},
)

type R = typeof routes.$types
type Keys = keyof R & string

expectTypeOf<Has<Keys, 'page /p0/$id'>>().toEqualTypeOf<true>()
expectTypeOf<Has<Keys, 'page /p${N - 1}/$id'>>().toEqualTypeOf<true>()
expectTypeOf<IsExactKeys<Keys>>().toEqualTypeOf<true>()
expectTypeOf<R>().not.toBeAny()
expectTypeOf<R['page /p0/$id']['route']['types']['params']['id']>().toEqualTypeOf<string>()
expectTypeOf<R['page /p${N - 1}/$id']['route']['types']['params']['id']>().toEqualTypeOf<string>()
expectTypeOf<R['page /p${N - 1}/$id']['route']['types']['fullPath']>().toEqualTypeOf<'/p${N - 1}/$id'>()
`,

  'endpoints.ts': `${header}import http from '@kitr/api/routes'

export const routes = defineRoutes([http], (r) =>
  r.group('/api', (api) =>
    api
${endpointChain('e', N)},
  ),
)

type R = typeof routes.$types
type Keys = keyof R & string

expectTypeOf<Has<Keys, 'e0'>>().toEqualTypeOf<true>()
expectTypeOf<Has<Keys, 'e${N - 1}'>>().toEqualTypeOf<true>()
expectTypeOf<IsExactKeys<Keys>>().toEqualTypeOf<true>()
expectTypeOf<R>().not.toBeAny()
expectTypeOf<R['e${N - 1}']['params']>().toEqualTypeOf<{ id: string }>()
expectTypeOf<R['e${N - 1}']['output']>().toEqualTypeOf<{ n: number; id: string }>()
expectTypeOf<R['e${N - 1}']['path']>().toEqualTypeOf<'/api/e${N - 1}/:id'>()
expectTypeOf<R['e${N - 1}']['method']>().toEqualTypeOf<'GET'>()
`,

  'merge.ts': `${header}import http from '@kitr/api/routes'
import pages from '@kitr/router/routes'

declare const Page: () => null

const a = defineRoutes([pages, http], (r) =>
  r
${pageChain('a', 50)}
    .group('/api', (api) =>
      api
${endpointChain('a', 50)},
    ),
)
const b = defineRoutes([pages, http], (r) =>
  r
${pageChain('b', 50)}
    .group('/api', (api) =>
      api
${endpointChain('b', 50)},
    ),
)
const c = defineRoutes([pages, http], (r) =>
  r
${pageChain('c', 50)}
    .group('/api', (api) =>
      api
${endpointChain('c', 50)},
    ),
)

export const routes = defineRoutes([pages, http], (r) => r.merge(a).merge(b).merge(c))

type R = typeof routes.$types
type Keys = keyof R & string

expectTypeOf<R>().not.toBeAny()
expectTypeOf<IsExactKeys<Keys>>().toEqualTypeOf<true>()
expectTypeOf<Has<Keys, 'page /a0/$id'>>().toEqualTypeOf<true>()
expectTypeOf<Has<Keys, 'page /b49/$id'>>().toEqualTypeOf<true>()
expectTypeOf<Has<Keys, 'page /c49/$id'>>().toEqualTypeOf<true>()
expectTypeOf<Has<Keys, 'a0'>>().toEqualTypeOf<true>()
expectTypeOf<Has<Keys, 'c49'>>().toEqualTypeOf<true>()
expectTypeOf<R['page /c49/$id']['route']['types']['params']['id']>().toEqualTypeOf<string>()
expectTypeOf<R['c49']['params']>().toEqualTypeOf<{ id: string }>()
expectTypeOf<R['b49']['output']>().toEqualTypeOf<{ n: number; id: string }>()
`,
}

const tsconfig = {
  extends: '../../../../tsconfig.base.json',
  compilerOptions: {
    types: [],
    baseUrl: '.',
    paths: {
      '@kitr/core': ['../../../core/dist/index.d.ts'],
      '@kitr/router/routes': ['../../dist/routes.d.ts'],
      '@kitr/api/routes': ['../../../api/dist/routes.d.ts'],
    },
  },
  include: Object.keys(fixtures),
}

describe('route table type performance', () => {
  afterAll(() => {
    if (!process.env.KITR_KEEP_TYPE_PERF) rmSync(dir, { recursive: true, force: true })
  })

  it(`checks ${N} pages, ${N} endpoints and three merged tables exactly, in under ${BUDGET_SECONDS}s`, () => {
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    for (const [file, source] of Object.entries(fixtures)) writeFileSync(join(dir, file), source)
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))

    const tsc = join(root, 'node_modules/typescript/bin/tsc')
    const check = () => {
      const result = spawnSync(
        process.execPath,
        [tsc, '--noEmit', '--extendedDiagnostics', '-p', join(dir, 'tsconfig.json')],
        { cwd: root, encoding: 'utf8', timeout: 120_000 },
      )
      const output = `${result.stdout}${result.stderr}`
      expect(output, 'tsc reported TS2589 (type instantiation too deep)').not.toMatch(/TS2589/)
      expect(output, 'tsc reported errors (is the workspace built? run `pnpm build`)').not.toMatch(
        /error TS\d+/,
      )
      expect(result.status, output).toBe(0)
      const seconds = Number(/Check time:\s+([\d.]+)s/.exec(output)?.[1])
      const instantiations = Number(/Instantiations:\s+(\d+)/.exec(output)?.[1])
      expect(seconds, `no "Check time" in tsc output:\n${output}`).not.toBeNaN()
      return { seconds, instantiations }
    }

    // Instantiations are deterministic (about 1.6M today); the clock is not, and the unit job runs
    // this beside every other suite. A run over budget gets one retry, and the budget grows with
    // the machine's load (load average over core count, never below 1) so a busy runner is not a
    // type regression. The instantiation cap catches regressions either way.
    const budget = () => BUDGET_SECONDS * Math.max(1, loadavg()[0]! / cpus().length)
    let { seconds, instantiations } = check()
    if (seconds >= budget()) ({ seconds, instantiations } = check())
    console.info(`type-perf: check ${seconds}s, ${instantiations} instantiations`)
    expect(instantiations).toBeLessThan(MAX_INSTANTIATIONS)
    expect(seconds).toBeLessThan(budget())
  }, 150_000)
})
