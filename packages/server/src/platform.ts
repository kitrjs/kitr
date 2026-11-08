import { definePlatform, type PlatformContext, type PlatformFinding } from '@kitr/core'

/** The runtimes the server platform can run its entry on. */
export type ServerRuntime = 'node' | 'bun' | 'deno' | 'workers'

/** Options for `server()` in `kitrrc.ts`. */
export interface ServerPlatformOptions {
  /** Where the server runs. `node` (tsx in dev, node in production), `bun`, `deno` or Cloudflare `workers` (wrangler). Default `node`. */
  runtime: ServerRuntime
  /** Port for `kitr dev` and `kitr start`. Default 3001. */
  port: number
  /** Host to bind. Default `0.0.0.0` in production, `localhost` in dev. */
  host?: string
  /** The server entry. Default `server/main.ts`. */
  entry: string
}

const RUNTIMES: ServerRuntime[] = ['node', 'bun', 'deno', 'workers'] // kitr-allow-module-state: constant list, never mutated

/**
 * The server platform: the kitr app on h3 as its own process. List it in kitrrc.ts:
 *
 *   platforms: { api: server({ runtime: 'node', port: 3001 }) }
 *
 * `kitr dev api` watches `server/main.ts`, `kitr build api` typechecks (or bundles for workers),
 * `kitr start api` runs it. With a web platform the same server also answers its own paths
 * inside the Start process through `app/server.ts`.
 */
export const server = definePlatform<ServerPlatformOptions>(
  {
    type: 'server',
    description: 'HTTP server on h3: Node, Bun, Deno or Cloudflare Workers.',
    requires: ['server'],
    describe: {
      runtime: {
        description: 'JavaScript runtime',
        type: 'string',
        values: RUNTIMES,
        default: 'node',
      },
      port: { description: 'Port to listen on', type: 'number', default: 3001 },
      host: { description: 'Host to bind', type: 'string' },
      entry: { description: 'Server entry file', type: 'string', default: 'server/main.ts' },
    },
    options: {
      '~standard': {
        version: 1,
        vendor: 'kitr',
        validate(value) {
          const v = (value ?? {}) as Partial<ServerPlatformOptions>
          const runtime = v.runtime ?? 'node'
          if (!RUNTIMES.includes(runtime))
            return {
              issues: [
                { message: `runtime must be one of ${RUNTIMES.join(', ')}`, path: ['runtime'] },
              ],
            }
          if (v.port !== undefined && (typeof v.port !== 'number' || v.port < 0 || v.port > 65535))
            return {
              issues: [{ message: 'port must be a number between 0 and 65535', path: ['port'] }],
            }
          return {
            value: {
              runtime,
              port: v.port ?? 3001,
              host: v.host,
              entry: v.entry ?? 'server/main.ts',
            },
          }
        },
      },
    },
  },
  (options) => ({
    dependencies: [
      { name: 'h3' },
      { name: 'srvx' },
      ...(options.runtime === 'node' ? [{ name: 'tsx', dev: true }] : []),
      ...(options.runtime === 'workers' ? [{ name: 'wrangler', dev: true }] : []),
    ],
    scaffold(ctx) {
      const pkg = readPackage(ctx)
      const react = 'react' in { ...pkg.dependencies } || rcPackages(ctx).includes('@kitr/react')
      const entryName = options.entry.split('/').pop()
      const table = 'server/routes.ts'
      // The server table always exists, so every package that adds endpoints or sockets extends
      // the same file and the entry never changes shape.
      if (!ctx.exists(table))
        ctx.write(
          table,
          `import { defineRoutes } from 'kitr/app'

/** Endpoints and sockets of this app. \`kitr add api\` / \`kitr add realtime\` add their methods here. */
export const routes = defineRoutes([], (r) => r)

export type ServerRoutes = typeof routes.$types
`,
        )
      const routesSpec = react ? '#server/routes' : relativeImport(options.entry, table)
      ctx.write(
        options.entry,
        `import { loadRc } from 'kitr/app'
import { createServer } from 'kitr/server'
import { routes } from '${routesSpec}'
import { config } from '../config'
import rc from '../kitrrc'

/** The kitr server: providers from kitrrc.ts, config from config/, routes from ${table}. What \`kitr dev ${ctx.name}\` runs${react ? ", what app/server.ts hands the app's own requests to" : ''}, what tests call with \`server.fetch(new Request(...))\`. */
export const server = createServer({ ...loadRc(rc, config), routes })

/** Fetch handler for runtimes that call it (Cloudflare Workers, Deno Deploy). */
export default server

const isMain = (import.meta as { main?: boolean }).main ?? process.argv[1]?.endsWith(${JSON.stringify(entryName)})
if (isMain) {
  server.listen({
    port: Number(process.env.PORT) || ${options.port},
    host: process.env.HOST${options.host ? ` ?? ${JSON.stringify(options.host)}` : ''},
  })
}
`,
      )
      // A web platform in the same app answers the server's paths in the Start process, in dev
      // and in ssr builds: Start's server entry asks the kitr server first.
      if (react && ctx.platforms.some((p) => p.type === 'web'))
        ctx.write(
          'app/server.ts',
          `import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { server } from '#server/main'

/** Requests for paths the kitr server has routes for (endpoints, sockets, /healthz) go to it; pages go to Start. */
export default createServerEntry({
  fetch(request, options) {
    if (server.handles(request)) return server.fetch(request)
    return handler.fetch(request, options)
  },
})
`,
        )
      if (options.runtime === 'workers')
        ctx.write(
          `platforms/${ctx.name}/wrangler.toml`,
          `name = "${slug(readPackage(ctx).name)}-${ctx.name}"
main = "../../${options.entry}"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
`,
        )
    },
    async dev(ctx) {
      const port = String(ctx.flags.port ?? options.port)
      const env = { PORT: port, HOST: String(ctx.flags.host ?? options.host ?? 'localhost') }
      switch (options.runtime) {
        case 'node':
          return ctx.exec('tsx', ['watch', options.entry], { env })
        case 'bun':
          return ctx.run('bun', ['--watch', options.entry], { env })
        case 'deno':
          return ctx.run('deno', ['run', '--watch', '-A', options.entry], { env })
        case 'workers':
          return ctx.exec('wrangler', ['dev', '--port', port], { cwd: ctx.dir() })
      }
    },
    async build(ctx) {
      if (options.runtime === 'workers') {
        await ctx.exec(
          'wrangler',
          ['deploy', '--dry-run', '--outdir', `${ctx.root}/dist/${ctx.name}`],
          { cwd: ctx.dir() },
        )
        ctx.log.success(
          `${ctx.name}: bundled into dist/${ctx.name}; deploy with \`${ctx.pm} exec wrangler deploy\` from platforms/${ctx.name}`,
        )
        return
      }
      await ctx.exec('tsc', ['--noEmit', '-p', 'tsconfig.json'])
      ctx.log.success(
        `${ctx.name}: typechecked. \`kitr start ${ctx.name}\` runs ${options.entry} with ${options.runtime}.`,
      )
    },
    async start(ctx) {
      const env = {
        PORT: String(ctx.flags.port ?? options.port),
        HOST: String(ctx.flags.host ?? options.host ?? '0.0.0.0'),
      }
      switch (options.runtime) {
        case 'node':
          return ctx.run('node', ['--import', 'tsx', options.entry], { env })
        case 'bun':
          return ctx.run('bun', [options.entry], { env })
        case 'deno':
          return ctx.run('deno', ['run', '-A', options.entry], { env })
        case 'workers':
          return ctx.exec('wrangler', ['dev', '--port', env.PORT], { cwd: ctx.dir() })
      }
    },
    doctor(ctx) {
      const out: PlatformFinding[] = []
      const pkg = readPackage(ctx)
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      if (!ctx.exists(options.entry))
        out.push({
          level: 'error',
          message: `${ctx.name}: ${options.entry} is missing`,
          fix: `kitr platforms scaffold ${ctx.name}`,
        })
      for (const dep of ['h3', 'srvx'])
        if (!(dep in deps))
          out.push({
            level: 'error',
            message: `${ctx.name}: ${dep} is not installed`,
            fix: `${ctx.pm} add ${dep}`,
          })
      if (options.runtime === 'node' && !('tsx' in deps))
        out.push({
          level: 'error',
          message: `${ctx.name}: tsx is not installed (runs the server in dev)`,
          fix: `${ctx.pm} add -D tsx`,
        })
      if (options.runtime === 'workers' && !('wrangler' in deps))
        out.push({
          level: 'error',
          message: `${ctx.name}: wrangler is not installed`,
          fix: `${ctx.pm} add -D wrangler`,
        })
      return out
    },
    agents: `- \`kitr dev <name>\` runs ${options.entry} with ${options.runtime === 'node' ? 'tsx watch' : options.runtime}; \`kitr start <name>\` runs the production server; tests import \`server\` from it and call \`server.fetch(new Request(...))\`, no port needed.
- Endpoints and sockets live in \`server/routes.ts\` (\`defineRoutes([api, realtime], ...)\`), passed to \`createServer({ routes })\`; controllers in \`server/controllers/\`. Config comes from \`config/server.ts\`; the port comes from the platform options in kitrrc.ts, \`PORT\` or \`kitr dev <name> --port\`.
- Never import React or browser APIs under \`server/\`; this entry must stay runnable without a DOM.`,
  }),
)

/** `server/main.ts` importing `server/routes.ts` → `./routes`; across directories → `../x/routes`. */
function relativeImport(from: string, to: string): string {
  const fromParts = from.split('/').slice(0, -1)
  const toParts = to.replace(/\.tsx?$/, '').split('/')
  let i = 0
  while (i < fromParts.length && i < toParts.length - 1 && fromParts[i] === toParts[i]) i++
  const up = fromParts.length - i
  const rest = toParts.slice(i).join('/')
  return up === 0 ? `./${rest}` : `${'../'.repeat(up)}${rest}`
}

function readPackage(ctx: PlatformContext): Record<string, any> {
  try {
    return JSON.parse(ctx.read('package.json'))
  } catch {
    return {}
  }
}

function rcPackages(ctx: PlatformContext): string[] {
  for (const name of ['kitrrc.ts', 'kitrrc.mts', 'kitrrc.js', 'kitrrc.mjs']) {
    if (!ctx.exists(name)) continue
    const block = ctx.read(name).match(/packages\s*:\s*\[([\s\S]*?)\]/)?.[1] ?? ''
    return [...block.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]!)
  }
  return []
}

function slug(name = 'app') {
  return (
    name
      .replace(/^@[^/]+\//, '')
      .replace(/[^a-z0-9-]/gi, '-')
      .toLowerCase() || 'app'
  )
}
