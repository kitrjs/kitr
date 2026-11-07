import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * `kitr api:sync` and `kitr routes:list`. Plain command objects (citty's shape) so this module
 * needs no CLI dependency; the kitr CLI mounts them when `@kitr/api` is in kitrrc.ts.
 */

const root = () => process.cwd()

async function loadRoutes(file?: string) {
  // The route table (`directories.routeTable`), then the older per-kit locations.
  const candidates = file
    ? [file]
    : ['server/routes.ts', 'app/routes.ts', 'app/api/routes.ts', 'start/routes.ts']
  const path = candidates.map((c) => resolve(root(), c)).find(existsSync)
  if (!path) throw new Error(`No routes file found (${candidates.join(', ')}). Pass --file.`)
  const { createJiti } = await import('jiti')
  const jiti = createJiti(resolve(root(), 'package.json'), { alias: readAliases() })
  const mod = (await jiti.import(path)) as Record<string, unknown>
  const api = (await jiti.import('kitr/api')) as {
    toOpenApi: (
      router: unknown,
      info: { title: string; version: string; description?: string },
    ) => Promise<unknown>
  }
  const router = (mod.routes ?? mod.default) as
    | { routes: unknown[]; toJSON(): unknown[] }
    | undefined
  if (!router || typeof router.toJSON !== 'function')
    throw new Error(`${path} must export \`routes\` from defineRoutes()`)
  return { router, path, api, jiti }
}

/** What `config/api.ts` sets, loaded the way the app loads it. Empty when there is no file. */
export interface ApiSyncConfig {
  prefix?: string
  openapi?: { path?: string; title?: string; version?: string; description?: string }
  client?: { path?: string }
}

/**
 * The output paths and document info `kitr api:sync` uses: `openapi.*` from config/api.ts, the
 * route table next to `client.path` (default `app/api/client.ts`, or `server/` for a backend).
 */
export function syncPlan(
  config: ApiSyncConfig,
  project: { name?: string; version?: string; hasAppApi: boolean },
  out?: string,
) {
  const clientDir = config.client?.path
    ? config.client.path.replace(/\/[^/]*\.[cm]?[jt]sx?$/, '')
    : project.hasAppApi
      ? 'app/api'
      : 'server'
  return {
    out: out ?? config.openapi?.path ?? 'openapi.json',
    tablePath: `${clientDir.replace(/\/$/, '')}/routes.gen.ts`,
    info: {
      title: config.openapi?.title ?? `${project.name ?? 'app'} API`,
      version: config.openapi?.version ?? project.version ?? '0.0.0',
      ...(config.openapi?.description ? { description: config.openapi.description } : {}),
    },
  }
}

/** Routes outside `prefix` (config/api.ts): the typed client calls them without the prefix, which is usually a mistake. */
export function outsidePrefix(routes: Array<{ path: string }>, prefix?: string): string[] {
  if (!prefix || prefix === '/') return []
  const base = prefix.replace(/\/$/, '')
  return routes.map((r) => r.path).filter((path) => path !== base && !path.startsWith(`${base}/`))
}

function readAliases(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    const ts = JSON.parse(readFileSync(resolve(root(), 'tsconfig.json'), 'utf8'))
    for (const [k, v] of Object.entries<string[]>(ts.compilerOptions?.paths ?? {}))
      out[k.replace('/*', '')] = resolve(root(), v[0]!.replace('/*', ''))
  } catch {}
  return out
}

function readConfig(file: string): string {
  const path = resolve(root(), file)
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

function write(file: string, content: string) {
  const path = resolve(root(), file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

/** `kitr api:sync`: writes the OpenAPI document and the client route table from the routes file. */
export const apiSync = {
  meta: {
    name: 'api:sync',
    description: 'Write the OpenAPI document and the client route table from your routes file.',
  },
  args: {
    file: { type: 'string', description: 'Routes file (default: server/routes.ts)' },
    out: {
      type: 'string',
      description: 'OpenAPI output path (default: openapi.path in config/api.ts, or openapi.json)',
    },
  },
  async run({ args }: { args: { file?: string; out?: string } }) {
    const { router, api, jiti } = await loadRoutes(args.file)
    const pkg = JSON.parse(readConfig('package.json') || '{}') as {
      name?: string
      version?: string
    }
    const configPath = resolve(root(), 'config/api.ts')
    const config: ApiSyncConfig = existsSync(configPath)
      ? ((await jiti.import(configPath, { default: true })) ?? {})
      : {}
    const { out, tablePath, info } = syncPlan(
      config,
      { name: pkg.name, version: pkg.version, hasAppApi: existsSync(resolve(root(), 'app/api')) },
      args.out,
    )
    const doc = await api.toOpenApi(router, info)
    write(out, `${JSON.stringify(doc, null, 2)}\n`)
    // Sockets share the table with endpoints; the client table only lists what it can call.
    const table = (router.toJSON() as Array<{ kind?: string; name?: string; method: string; path: string }>).filter(
      (r) => !r.kind || r.kind === 'http',
    )
    write(
      tablePath,
      `// Generated by \`kitr api:sync\`. Do not edit.\nexport const routeTable = ${JSON.stringify(
        table.map((r) => ({ name: r.name, method: r.method, path: r.path })),
        null,
        2,
      )} as const\n`,
    )
    console.log(`✔ ${table.length} routes → ${out}, ${tablePath}`)
  },
}

/** `kitr routes:list`: prints every route with its method, path and name. */
export const routesList = {
  meta: {
    name: 'routes:list',
    description: 'Print the route table: pages, endpoints and sockets.',
  },
  args: { file: { type: 'string' } },
  async run({ args }: { args: { file?: string } }) {
    const { router } = await loadRoutes(args.file)
    for (const r of router.toJSON() as Array<{
      kind?: string
      method?: string
      transport?: string
      path: string
      name: string
    }>) {
      const verb = r.method ?? (r.transport === 'sse' ? 'SSE' : (r.kind ?? '').toUpperCase())
      console.log(`  ${verb.padEnd(7)} ${r.path.padEnd(40)} ${r.name}`)
    }
  },
}

export default { 'api:sync': apiSync, 'routes:list': routesList }
