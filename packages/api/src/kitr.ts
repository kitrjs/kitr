import { definePackage, generatorFile, naming } from '@kitr/core/package'

/**
 * `kitr add api`: Adonis-style router, controllers, validators and middleware on the server,
 * a typed client with no codegen, OpenAPI through `kitr api:sync`.
 */
export default definePackage({
  name: 'api',
  requires: ['server'],
  routes: '@kitr/api/routes',
  add(ctx) {
    const serverOnly = !(ctx.has('react') || ctx.hasPackage('react'))
    ctx.config(
      'api',
      `import { defineConfig } from '@kitr/api'\n\nexport default defineConfig({\n  prefix: '/api',\n  openapi: { path: 'openapi.json', title: '${ctx.pkg.name ?? 'app'} API', version: '0.1.0' },\n})\n`,
    )
    // The server table: endpoints, and sockets when realtime is added. Skipped when it exists.
    ctx.write(
      'server/routes.ts',
      `import { defineRoutes } from 'kitr/app'\nimport api from '@kitr/api/routes'\nimport HealthController from '#server/controllers/health-controller'\n\n/**\n * Endpoints and sockets of this app. \`kitr add\` keeps the extension list current; \`createServer({ routes })\`\n * in server/main.ts serves it.\n */\nexport const routes = defineRoutes([api], (root) =>\n  root.group('/api', (r) =>\n    r.get('/health', [HealthController, 'show'], { name: 'health' }),\n    // r.resource('projects', () => import('#server/controllers/projects-controller'))\n  ),\n)\n\n/** Pass to createApiClient<ServerRoutes>() on the client. */\nexport type ServerRoutes = typeof routes.$types\n`,
    )
    // Idempotent: adds the http methods to a table another package created, and hands the
    // table to `createServer()` in a server/main.ts written before it existed.
    ctx.routes.extend('@kitr/api/routes', { table: 'server' })
    ctx.write(
      'server/controllers/health-controller.ts',
      `import type { HttpContext } from '@kitr/api'\n\nexport default class HealthController {\n  async show({ requestId }: HttpContext) {\n    return { ok: true, requestId }\n  }\n}\n`,
    )
    if (!serverOnly) {
      // The client resolves route names through this table: without it every call throws
      // "Unknown route". `kitr api:sync` rewrites it from server/routes.ts.
      ctx.write(
        'app/api/routes.gen.ts',
        `// Route table for the typed client. Regenerate with \`kitr api:sync\`.\nexport const routeTable = ${JSON.stringify([{ name: 'health', method: 'GET', path: '/api/health' }], null, 2)} as const\n`,
      )
      ctx.write(
        'app/api/client.ts',
        `import { createApiClient, registerRoutes } from '@kitr/api/client'\nimport type { ServerRoutes } from '#server/routes'\nimport { routeTable } from './routes.gen'\n\n/** Typed, no codegen: route names, params, bodies and outputs come from the server table. */\nexport const api = createApiClient<ServerRoutes>({ baseUrl: typeof window === 'undefined' ? \`http://localhost:\${process.env.PORT ?? 3000}\` : '' })\nregisterRoutes(api, [...routeTable])\n`,
      )
    }
    ctx.scripts.add('api:sync', 'kitr api:sync')
    ctx.agents.add(
      'api',
      `- Endpoints: \`server/routes.ts\` (\`defineRoutes([api], ...)\` with \`.get/.post/.resource\` from \`@kitr/api/routes\`; realtime adds \`.ws\` to the same table), controllers in \`server/controllers/<name>_controller.ts\` (\`kitr make:controller <name> --resource\`). Validators go in \`static validation = { store: { body: schema } }\`.\n- Actions are for this app's own UI; API routes are for anything else (mobile, partners, webhooks) or when you want REST + OpenAPI.\n- The client is typed from \`ServerRoutes\` (\`typeof routes.$types\`); call \`registerRoutes(api, routes.toJSON())\` or use \`kitr api:sync\` to write the route table and openapi.json.`,
    )
  },
  remove(ctx) {
    ctx.routes.remove('@kitr/api/routes', { table: 'server' })
    ctx.scripts.remove('api:sync', 'kitr api:sync')
    ctx.agents.remove('api')
  },
  commands: () => import('./commands'),
  // `kitr generate` (and so `kitr dev`, `kitr build`, `kitr typecheck`) keeps routes.gen.ts and openapi.json fresh.
  generate: {
    command: 'api:sync',
    watch: ['server/**/*.ts', 'app/**/routes.ts', 'config/api.ts'],
  },
  generators: {
    controller: {
      description: 'Create a controller in server/controllers',
      definition: 'A class whose methods answer routes; validation goes in static validation.',
      args: {
        resource: {
          type: 'boolean',
          description: 'Generate index/show/store/update/destroy',
          default: false,
        },
      },
      target: (name, project, args) => {
        const out = generatorFile(project, 'server', 'controllers', name, { suffix: '-controller' })
        return { file: out.file, vars: { ...out.vars, resource: String(args.resource ?? false) } }
      },
      // Routes stay hand-written (their paths and names are yours): print the line to add.
      after(ctx, { file, vars }) {
        const spec = `#server/${file.split('/').slice(1).join('/').replace(/\.ts$/, '')}`
        const path = [vars.dir, vars.kebab].filter(Boolean).join('/')
        const line =
          vars.resource === 'true'
            ? `r.resource('${path}', () => import('${spec}'))`
            : `r.get('/${path}', [${naming.pascal(vars.name)}Controller, 'handle'])  // import ${naming.pascal(vars.name)}Controller from '${spec}'`
        ctx.log.step(`route it in server/routes.ts: ${line}`)
      },
      stub: ({ name, resource }) =>
        resource === 'true'
          ? `import type { HttpContext } from '@kitr/api'
import { KitrError } from 'kitr/app'
import { z } from 'zod'

const create${naming.pascal(name)} = z.object({ name: z.string().min(2) })
const update${naming.pascal(name)} = create${naming.pascal(name)}.partial()

export default class ${naming.pascal(name)}Controller {
  static validation = {
    store: { body: create${naming.pascal(name)} },
    update: { body: update${naming.pascal(name)} },
  }

  async index({ query }: HttpContext) {
    return { items: [], page: Number(query.page ?? 1) }
  }

  async show({ params }: HttpContext<{ id: string }>) {
    throw KitrError.notFound('${naming.pascal(name)} ' + params.id)
  }

  async store({ body, response }: HttpContext<{}, {}, z.infer<typeof create${naming.pascal(name)}>>) {
    response.status(201)
    return { id: '1', ...body }
  }

  async update({ params, body }: HttpContext<{ id: string }, {}, z.infer<typeof update${naming.pascal(name)}>>) {
    return { id: params.id, ...body }
  }

  async destroy({ params }: HttpContext<{ id: string }>) {
    void params
  }
}
`
          : `import type { HttpContext } from '@kitr/api'

export default class ${naming.pascal(name)}Controller {
  async handle({ request }: HttpContext) {
    return { path: request.url.pathname }
  }
}
`,
    },
    middleware: {
      description: 'Create an API middleware in server/middleware',
      definition: 'A function that runs before and after a controller (auth, audit, rate limits).',
      target: (name, project) => ({
        ...generatorFile(project, 'server', 'middleware', name),
      }),
      stub: ({ name }) => `import { defineMiddleware } from '@kitr/api'

export const ${naming.camel(name)} = defineMiddleware(async (ctx, next) => {
  // Before the handler
  const result = await next()
  // After the handler
  return result
})
`,
    },
    validator: {
      description: 'Create a shared zod schema in app/validators',
      definition: 'A zod schema and its type, shared by forms, actions and controllers.',
      target: (name, project) => ({
        ...generatorFile(project, 'app', 'validators', name),
      }),
      stub: ({ name }) => `import { z } from 'zod'

/** Shared between the form, the action and the controller, so one schema decides what is valid. */
export const ${naming.camel(name)}Schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
})

export const create${naming.pascal(name)}Schema = ${naming.camel(name)}Schema
export const update${naming.pascal(name)}Schema = ${naming.camel(name)}Schema.partial()

export type ${naming.pascal(name)}Input = z.infer<typeof ${naming.camel(name)}Schema>
`,
    },
  },
  vite: { serverOnlyConfig: true },
})
