import { definePackage, naming } from '@kitr/core/package'

/**
 * `kitr add api`: Adonis-style router, controllers, validators and middleware on the server,
 * a typed client with no codegen, OpenAPI through `kitr api:sync`.
 */
export default definePackage({
  name: 'api',
  requires: ['server'],
  add(ctx) {
    const serverOnly = !(ctx.has('react') || ctx.hasPackage('react'))
    ctx.config(
      'api',
      `import { defineConfig } from 'kitr/api'\n\nexport default defineConfig({\n  prefix: '/api',\n  openapi: { path: 'openapi.json', title: '${ctx.pkg.name ?? 'app'} API', version: '0.1.0' },\n})\n`,
    )
    ctx.write(
      'server/routes.ts',
      `import { defineRoutes } from 'kitr/api'\nimport HealthController from '#server/controllers/health_controller'\n\nexport const routes = defineRoutes((router) =>\n  router.group({ prefix: '/api' }, (api) =>\n    api.get('/health', [HealthController, 'show'], { name: 'health' }),\n    // api.resource('projects', () => import('#server/controllers/projects_controller'))\n  ),\n)\n\n/** Pass to createApiClient<AppRoutes>() on the client. */\nexport type AppRoutes = typeof routes.$types\n`,
    )
    ctx.write(
      'server/controllers/health_controller.ts',
      `import type { HttpContext } from 'kitr/api'\n\nexport default class HealthController {\n  async show({ requestId }: HttpContext) {\n    return { ok: true, requestId }\n  }\n}\n`,
    )
    // A server platform added earlier wrote server/main.ts without the router; mount it now.
    ctx.server.attach({
      marker: 'mountRoutes',
      import: "import { mountRoutes } from 'kitr/api'\nimport { routes } from './routes'",
      line: 'mountRoutes(server, routes)',
      first: true,
    })
    if (!serverOnly) {
      // The client resolves route names through this table: without it every call throws
      // "Unknown route". `kitr api:sync` rewrites it from server/routes.ts.
      ctx.write(
        'app/api/routes.gen.ts',
        `// Route table for the typed client. Regenerate with \`kitr api:sync\`.\nexport const routeTable = ${JSON.stringify([{ name: 'health', method: 'GET', path: '/api/health' }], null, 2)} as const\n`,
      )
      ctx.write(
        'app/api/client.ts',
        `import { createApiClient, registerRoutes } from 'kitr/api/client'\nimport type { AppRoutes } from '#server/routes'\nimport { routeTable } from './routes.gen'\n\n/** Typed, no codegen: route names, params, bodies and outputs come from the router. */\nexport const api = createApiClient<AppRoutes>({ baseUrl: typeof window === 'undefined' ? \`http://localhost:\${process.env.PORT ?? 3000}\` : '' })\nregisterRoutes(api, [...routeTable])\n`,
      )
    }
    ctx.scripts.add('api:sync', 'kitr api:sync')
    ctx.agents.add(
      'api',
      `- Routes: \`server/routes.ts\` (\`defineRoutes\`), controllers in \`server/controllers/<name>_controller.ts\` (\`kitr make:controller <name> --resource\`). Validators go in \`static validation = { store: { body: schema } }\`.\n- Actions are for this app's own UI; API routes are for anything else (mobile, partners, webhooks) or when you want REST + OpenAPI.\n- The client is typed from \`typeof routes.$types\`; call \`registerRoutes(api, routes.toJSON())\` or use \`kitr api:sync\` to write the route table and openapi.json.`,
    )
  },
  remove(ctx) {
    ctx.scripts.remove('api:sync', 'kitr api:sync')
    ctx.agents.remove('api')
  },
  commands: () => import('./commands'),
  generators: {
    controller: {
      description: 'Create a controller in server/controllers',
      args: {
        resource: {
          type: 'boolean',
          description: 'Generate index/show/store/update/destroy',
          default: false,
        },
      },
      target: (name, project, args) => ({
        file: `${project.rc.directories.server ?? 'server'}/controllers/${naming.snake(name)}_controller.ts`,
        vars: { resource: String(args.resource ?? false) },
      }),
      stub: ({ name, resource }) =>
        resource === 'true'
          ? `import type { HttpContext } from 'kitr/api'
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
          : `import type { HttpContext } from 'kitr/api'

export default class ${naming.pascal(name)}Controller {
  async handle({ request }: HttpContext) {
    return { path: request.url.pathname }
  }
}
`,
    },
    middleware: {
      description: 'Create an API middleware in app/middleware',
      target: (name, project) => ({
        file: `${project.rc.directories.app ?? 'app'}/middleware/${naming.snake(name)}.ts`,
      }),
      stub: ({ name }) => `import { defineMiddleware } from 'kitr/api'

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
      target: (name, project) => ({
        file: `${project.rc.directories.app ?? 'app'}/validators/${naming.snake(name)}.ts`,
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
