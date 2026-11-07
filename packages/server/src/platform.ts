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

const RUNTIMES: ServerRuntime[] = ['node', 'bun', 'deno', 'workers']

/**
 * The server platform: the kitr app on h3 as its own process. List it in kitrrc.ts:
 *
 *   platforms: { api: server({ runtime: 'node', port: 3001 }) }
 *
 * `kitr dev api` watches `server/main.ts`, `kitr build api` typechecks (or bundles for workers),
 * `kitr start api` runs it. With a web platform in `ssr` mode the same server also answers
 * `/api/*` inside the Start process through `app/routes/api.$.ts`.
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
      const packages = rcPackages(ctx)
      const pkg = readPackage(ctx)
      const api = packages.includes('@kitr/api')
      const react = 'react' in { ...pkg.dependencies } || packages.includes('@kitr/react')
      const entryName = options.entry.split('/').pop()
      const realtime = packages.includes('@kitr/realtime') && ctx.exists('server/realtime.ts')
      const realtimePath = realtime
        ? (ctx.read('config/realtime.ts').match(/path\s*:\s*['"]([^'"]+)['"]/)?.[1] ?? '/ws')
        : '/ws'
      const attach = realtime
        ? `// WebSocket upgrades on ${realtimePath}, next to the routes.\nrealtime.attach(server, '${realtimePath}')\n`
        : ''
      ctx.write(
        options.entry,
        react
          ? `${api ? "import { mountRoutes } from 'kitr/api'\n" : ''}import { createServer } from 'kitr/server'
import { config } from '../config'
import rc from '../kitrrc'
${realtime ? "import { realtime } from '#server/realtime'\n" : ''}${api ? "import { routes } from '#server/routes'\n" : ''}
/** The kitr server: providers from kitrrc.ts, config from config/. What \`kitr dev ${ctx.name}\` runs, what the web platform's /api route delegates to, what tests call. */
export const server = createServer({ providers: rc.providers, config })
${api ? 'mountRoutes(server, routes)\n' : ''}${attach}
/** Fetch handler for runtimes that call it (Cloudflare Workers, Deno Deploy). */
export default server

const isMain = (import.meta as { main?: boolean }).main ?? process.argv[1]?.endsWith(${JSON.stringify(entryName)})
if (isMain) {
  server.listen({
    port: Number(process.env.PORT) || ${options.port},
    host: process.env.HOST${options.host ? ` ?? ${JSON.stringify(options.host)}` : ''},
  })
}
`
          : `import { createServer } from 'kitr/server'
${api ? "import { mountRoutes } from 'kitr/api'\n" : ''}import { config } from '../config'
import rc from '../kitrrc'
${realtime ? "import { realtime } from './realtime'\n" : ''}${api ? "import { routes } from './routes'\n" : ''}
/** The kitr server: providers from kitrrc.ts, config from config/. Tests import \`server\` and call \`server.fetch()\`. */
export const server = createServer({ providers: rc.providers, config })
${api ? 'mountRoutes(server, routes)\n' : ''}${attach}
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
      if (api && !ctx.exists('server/routes.ts'))
        ctx.write(
          'server/routes.ts',
          `import { defineRoutes } from 'kitr/api'

// Same-origin by default. To let another site call this API, add cors({ origin: ['https://app.example'] })
// from kitr/api to the group's middleware, or set cors in config/shield.ts.
export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api' }, (api) => {
    api.get('/health', () => ({ ok: true }), { name: 'health' })
    // api.resource('projects', () => import('./controllers/projects_controller'))
  }),
)

/** Pass to createApiClient<AppRoutes>() on the client. */
export type AppRoutes = typeof routes.$types
`,
        )
      // A web platform in the same app answers /api/* through this server, in dev and in ssr builds.
      if (react && ctx.platforms.some((p) => p.type === 'web') && ctx.exists('app/routes'))
        ctx.write(
          'app/routes/api.$.ts',
          `import { createFileRoute } from '@tanstack/react-router'
import { server } from '#server/main'

/** Every /api/* request goes to the kitr server (server/main.ts), in the Start process. */
export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      ANY: ({ request }) => server.fetch(request),
    },
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
- Routes live in \`server/routes.ts\` (\`defineRoutes\`), controllers in \`server/controllers/\`. Config comes from \`config/server.ts\`; the port comes from the platform options in kitrrc.ts, \`PORT\` or \`kitr dev <name> --port\`.
- Never import React or browser APIs under \`server/\`; this entry must stay runnable without a DOM.`,
  }),
)

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
