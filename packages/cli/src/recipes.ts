import type { Codemods } from './codemods'
import type { ProjectContext } from './context'
import { addonRecipes } from './recipes-addons'

export interface Recipe {
  name: string
  /** npm package this recipe installs, if any (recipes without one are setup-only). */
  package?: string
  description: string
  /** Other recipes that must be present first. */
  requires?: string[]
  /** Client-side recipe: refused in server-only projects. */
  client?: boolean
  configure(ctx: ProjectContext, codemods: Codemods): void | Promise<void>
  unconfigure?(ctx: ProjectContext, codemods: Codemods): void | Promise<void>
}

const r = (recipe: Recipe) => recipe

export const recipes: Record<string, Recipe> = {
  query: r({
    name: 'query',
    package: '@kitr/query',
    client: true,
    description:
      "TanStack Query over kitr's data contract: defineQuery, defineMutation, useSubscription.",
    configure(ctx, c) {
      c.installPackages([
        '@kitr/query',
        '@tanstack/react-query',
        { name: '@tanstack/react-query-devtools', dev: true },
      ])
      c.addProvider('@kitr/query/provider')
      c.addPackage('@kitr/query')
      ctx.write(
        'config/query.ts',
        `import { defineConfig } from 'kitr/query'\n\nexport default defineConfig({\n  // Navigating back within 30s never refetches.\n  staleTime: 30_000,\n})\n`,
      )
      c.addAgentsSection(
        'query',
        `- Import from \`kitr/query\`, never from \`@tanstack/react-query\` directly.\n- Every data source becomes \`defineQuery(...)\` / \`defineMutation(...)\` in \`app/features/<name>/queries.ts\`. Components use \`useSuspenseQuery(x.options(input))\`.\n- Route loaders call \`context.queryClient.ensureQueryData(x.options(input))\` so data is fetched once for server and client.\n- Mutations declare \`effects\` (invalidate/set keys). Never call \`queryClient.invalidateQueries\` inline in components.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/query/provider')
      c.removePackage('@kitr/query')
      c.removePackages(['@kitr/query', '@tanstack/react-query', '@tanstack/react-query-devtools'])
      c.removeAgentsSection('query')
    },
  }),
  http: r({
    name: 'http',
    package: '@kitr/http',
    client: true,
    requires: ['query'],
    description:
      'ky client with auth headers, token refresh and kitr error normalisation; httpQuery/httpMutation contracts.',
    configure(ctx, c) {
      c.installPackages(['@kitr/http', 'ky'])
      c.addProvider('@kitr/http/provider')
      c.addPackage('@kitr/http')
      c.addEnvSchema(
        'public',
        'VITE_API_URL',
        "e.url({ default: 'http://localhost:3333' })",
        'http://localhost:3333',
      )
      ctx.write(
        'config/http.ts',
        `import { defineConfig } from 'kitr/http'\nimport { env } from '#app/env'\n\nexport default defineConfig({\n  baseUrl: env.VITE_API_URL,\n  // getToken: () => auth.getToken(), refresh: () => auth.refresh(),\n})\n`,
      )
      c.addAgentsSection(
        'http',
        `- The HTTP client is \`app.container.use('http')\` (a ky instance). Wrap endpoints with \`httpQuery\`/\`httpMutation\` from \`kitr/http\` and pass them to \`defineQuery\`/\`defineMutation\`.\n- Errors are already \`KitrError\`; a 422 with \`fieldErrors\` maps onto form fields through \`<Form>\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/http/provider')
      c.removePackage('@kitr/http')
      c.removePackages(['@kitr/http', 'ky'])
      c.removeAgentsSection('http')
    },
  }),
  forms: r({
    name: 'forms',
    package: '@kitr/forms',
    client: true,
    description:
      'React Hook Form with Standard Schema resolvers, <Form> with server-error mapping, <FormField>.',
    configure(ctx, c) {
      c.installPackages(['@kitr/forms', 'react-hook-form', '@hookform/resolvers', 'zod'])
      c.addPackage('@kitr/forms')
      void ctx
      c.addAgentsSection(
        'forms',
        `- Forms: \`const form = useSchemaForm(schema, { defaultValues })\` then \`<Form form={form} onSubmit={...}>\` from \`kitr/forms\` (or the styled copy in \`app/components/ui/form.tsx\`).\n- Throw or reject with a KitrError carrying \`fieldErrors\` and the fields show the messages; anything else lands in \`useRootError()\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/forms')
      c.removePackages(['@kitr/forms', 'react-hook-form', '@hookform/resolvers'])
      c.removeAgentsSection('forms')
    },
  }),
  table: r({
    name: 'table',
    package: '@kitr/table',
    client: true,
    description: 'TanStack Table with sorting, pagination and filters bound to URL search params.',
    configure(_ctx, c) {
      c.installPackages(['@kitr/table', '@tanstack/react-table'])
      c.addPackage('@kitr/table')
      c.addAgentsSection(
        'table',
        `- Tables: \`validateSearch: parseTableSearch\` on the route, \`useUrlTableState({ search, setSearch })\` spread into \`useReactTable\` or the registry \`<DataTable>\`. Sorting/paging live in the URL, so views are shareable.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/table')
      c.removePackages(['@kitr/table', '@tanstack/react-table'])
      c.removeAgentsSection('table')
    },
  }),
  state: r({
    name: 'state',
    package: '@kitr/state',
    client: true,
    description: 'Zustand with an SSR-safe store factory (per-request stores on the server).',
    configure(ctx, c) {
      c.installPackages(['@kitr/state', 'zustand'])
      c.addPackage('@kitr/state')
      ctx.write('app/stores/.gitkeep', '')
      c.addAgentsSection(
        'state',
        `- Client state only. \`kitr make:store <name>\` writes \`app/stores/<name>.ts\` using \`createKitrStore\`. Server data belongs in queries, not stores.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/state')
      c.removePackages(['@kitr/state', 'zustand'])
      c.removeAgentsSection('state')
    },
  }),
  styling: r({
    name: 'styling',
    package: '@kitr/styling',
    client: true,
    description:
      'cx, cva, design tokens as CSS variables and typed CSS Modules helpers. Works without Tailwind.',
    configure(ctx, c) {
      c.installPackages(['@kitr/styling'])
      c.addPackage('@kitr/styling')
      ctx.write(
        'app/styles/tokens.css',
        `/* Override kitr tokens here. See kitr/ui/styles.css for the full list. */\n:root {\n  /* --kitr-color-primary: oklch(55% 0.2 262); */\n}\n`,
      )
      c.addAgentsSection(
        'styling',
        `- Plain CSS and CSS Modules are first-class: \`import styles from './x.module.css'\`, run \`kitr css:types\` for typed class names, compose with \`pick()\` from \`kitr/styling\`.\n- Colours and radii come from the \`--kitr-*\` variables; never hard-code them.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/styling')
      c.removePackages(['@kitr/styling'])
      c.removeAgentsSection('styling')
    },
  }),
  tailwind: r({
    name: 'tailwind',
    package: '@kitr/tailwind',
    client: true,
    description: 'Tailwind v4 via the Vite plugin, the kitr preset (tokens as @theme) and cn().',
    configure(ctx, c) {
      c.installPackages([
        '@kitr/tailwind',
        'tailwindcss',
        '@tailwindcss/vite',
        'clsx',
        'tailwind-merge',
        'class-variance-authority',
      ])
      c.addPackage('@kitr/tailwind')
      ctx.write(
        'config/tailwind.ts',
        `import { defineConfig } from 'kitr/tailwind'\n\nexport default defineConfig({\n  entry: 'app/styles/app.css',\n  preset: true,\n})\n`,
      )
      ctx.write(
        'app/styles/app.css',
        `@import 'tailwindcss';\n@import 'kitr/tailwind/preset.css';\n@import 'kitr/ui/styles.css';\n\n@source '../';\n`,
      )
      c.replaceCssImport('app/routes/__root.tsx', 'kitr/ui/styles.css', '#app/styles/app.css')
      c.addAgentsSection(
        'tailwind',
        `- Tailwind v4: utilities map to kitr tokens (\`bg-background\`, \`text-primary\`, \`rounded-md\`). Use \`cn()\` from \`kitr/tailwind\` to merge classes. Dark mode is \`data-theme="dark"\` on <html>, toggled by \`useTheme()\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/tailwind')
      c.removePackages(['@kitr/tailwind', 'tailwindcss', '@tailwindcss/vite', 'tailwind-merge'])
      c.removeAgentsSection('tailwind')
    },
  }),
  ui: r({
    name: 'ui',
    package: '@kitr/ui',
    client: true,
    description:
      'Theme provider, toasts (sonner) and the component registry config. Components are copied into app/components/ui.',
    configure(ctx, c) {
      c.installPackages(['@kitr/ui', 'sonner'])
      c.addProvider('@kitr/ui/provider')
      c.addPackage('@kitr/ui')
      ctx.write(
        'config/ui.ts',
        `import { defineConfig } from 'kitr/ui'\n\nexport default defineConfig({\n  theme: { default: 'system' },\n  toaster: { position: 'bottom-right' },\n  // Any shadcn-compatible registry. Default: kitr's.\n  // registry: 'https://raw.githubusercontent.com/PodkopovP/kitr/main/registry/dist',\n  componentsDir: 'app/components/ui',\n})\n`,
      )
      c.addAgentsSection(
        'ui',
        `- Components live in \`app/components/ui/\` and are owned by the app: edit them freely. Add more with \`kitr ui add <name>\` (shadcn-compatible registry).\n- Toasts: \`toast.success('Saved')\` from \`kitr/ui\`. Theme: \`useTheme()\`. Import \`kitr/ui/styles.css\` once (done in app/styles/app.css).`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/ui/provider')
      c.removePackage('@kitr/ui')
      c.removePackages(['@kitr/ui', 'sonner'])
      c.removeAgentsSection('ui')
    },
  }),
  auth: r({
    name: 'auth',
    package: '@kitr/auth',
    client: true,
    description:
      'Session in router context, requireAuth()/can() guards, token and Better Auth adapters, API middleware.',
    configure(ctx, c) {
      c.installPackages(['@kitr/auth'])
      c.addProvider('@kitr/auth/provider')
      c.addPackage('@kitr/auth')
      ctx.write(
        'app/abilities.ts',
        `import { defineAbilities } from 'kitr/auth'\n\nexport interface User {\n  id: string\n  email: string\n  role: 'admin' | 'member'\n}\n\nexport const abilities = defineAbilities<User>({\n  'projects.update': (user, project: { ownerId: string }) => user.role === 'admin' || project.ownerId === user.id,\n})\n`,
      )
      ctx.write(
        'config/auth.ts',
        `import { defineConfig, localStorageTokens, tokenAdapter } from 'kitr/auth'\nimport { type User, abilities } from '#app/abilities'\nimport { env } from '#app/env'\n\n// Swap for betterAuthAdapter(createAuthClient()) or a customAdapter({...}).\nconst adapter = tokenAdapter<User>({\n  abilities,\n  storage: localStorageTokens(),\n  fetchUser: async (token) => {\n    const res = await fetch(\`\${env.VITE_API_URL}/me\`, { headers: { authorization: \`Bearer \${token}\` } })\n    return res.ok ? ((await res.json()) as User) : null\n  },\n  signIn: async (credentials) => {\n    const res = await fetch(\`\${env.VITE_API_URL}/sign-in\`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials) })\n    if (!res.ok) throw new Error('Invalid credentials')\n    return (await res.json()) as { token: string; refreshToken?: string }\n  },\n})\n\nexport default defineConfig({ adapter, signInPath: '/sign-in' })\n`,
      )
      c.addAgentsSection(
        'auth',
        `- Guard routes with \`beforeLoad: requireAuth()\` (from \`kitr/router\`) on a layout route; permissions with \`can('projects.update', { subject })\` or \`useCan()\` in components.\n- The session is \`useSession()\` / \`useUser()\` from \`kitr/auth\`. Abilities are plain functions in \`app/abilities.ts\`, shared with the API middleware (\`kitr/auth/server\`).`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/auth/provider')
      c.removePackage('@kitr/auth')
      c.removePackages(['@kitr/auth'])
      c.removeAgentsSection('auth')
    },
  }),
  logger: r({
    name: 'logger',
    package: '@kitr/logger',
    description: 'Structured logger with levels, children and request ids. No dependencies.',
    configure(ctx, c) {
      c.installPackages(['@kitr/logger'])
      c.addProvider('@kitr/logger')
      c.addPackage('@kitr/logger')
      ctx.write(
        'config/logger.ts',
        `import { defineConfig } from 'kitr/logger'\n\nexport default defineConfig({\n  name: 'app',\n  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') ?? 'info',\n  // 'pretty' in dev, 'json' in production by default.\n})\n`,
      )
      c.addAgentsSection(
        'logger',
        `- Log through \`ctx.logger\` (request-scoped, carries the request id) or \`app.container.use('logger')\`. Never \`console.log\` in server code.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/logger')
      c.removePackage('@kitr/logger')
      c.removePackages(['@kitr/logger'])
      c.removeAgentsSection('logger')
    },
  }),
  server: r({
    name: 'server',
    package: '@kitr/server',
    requires: ['logger'],
    description:
      'The server runtime on h3. React apps switch to TanStack Start; backend-only apps get a standalone server.',
    configure(ctx, c) {
      const serverOnly = !('react' in { ...ctx.pkg.dependencies })
      c.installPackages(['@kitr/server', 'h3', 'srvx'])
      if (!serverOnly) c.installPackages(['@tanstack/react-start'])
      c.addPackage('@kitr/server')
      ctx.write(
        'config/server.ts',
        `import { defineConfig } from 'kitr/server'\n\nexport default defineConfig({\n  port: Number(process.env.PORT ?? 3000),\n  host: '0.0.0.0',\n  healthPath: '/healthz',\n  bodyLimit: 1024 * 1024,\n})\n`,
      )
      c.addEnv({ PORT: '3000', LOG_LEVEL: 'info' }, 'Server')
      if (serverOnly) {
        ctx.write(
          'server.ts',
          `import { createServer } from 'kitr/server'\nimport { mountRoutes } from 'kitr/api'\nimport rc from './kitrrc'\nimport { config } from './config'\nimport { routes } from './start/routes'\n\n/** Providers from kitrrc.ts, config from config/index.ts (kept in sync by \`kitr add\`). */\nexport const server = createServer({ providers: rc.providers, config })\nmountRoutes(server, routes)\n\nif (import.meta.main ?? process.argv[1]?.endsWith('server.ts')) {\n  server.listen()\n}\n`,
        )
      } else {
        // TanStack Start owns app/server.ts and app/client.tsx, so the kitr API server lives next to the routes.
        ctx.write(
          'app/api/server.ts',
          `import { createServer } from 'kitr/server'\nimport { mountRoutes } from 'kitr/api'\nimport serverConfig from '#config/server'\nimport { routes } from '#app/api/routes'\n\n/** The kitr server behind Start's /api/* catch-all route; also what tests call. */\nexport const server = createServer({ config: { server: serverConfig } })\nmountRoutes(server, routes)\n`,
        )
        // Start renders the whole document, so the root route becomes the HTML shell and the SPA entry goes away.
        const rootPath = 'app/routes/__root.tsx'
        const current = ctx.exists(rootPath) ? ctx.read(rootPath) : ''
        const cssImports = [...current.matchAll(/^import '([^']+\.css)'$/gm)].map((m) => m[1]!)
        if (!current.includes('<Scripts')) {
          ctx.write(
            rootPath,
            startRootRoute(cssImports.length ? cssImports : ['kitr/ui/styles.css']),
            { overwrite: true },
          )
        }
        c.remove('index.html')
        c.remove('app/main.tsx')
        c.addScript('start', 'kitr serve')
      }
      c.addAgentsSection(
        'server',
        `- Server code never imports React. Services come from the request-scoped container (\`useRequestApp()\`), logs from \`ctx.logger\`.\n- Providers' \`ready\`/\`shutdown\` run on \`server.listen()\`; in TanStack Start the server is a fetch handler (\`server.fetch\`).`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/server')
      c.removePackages(['@kitr/server', 'h3', 'srvx', '@tanstack/react-start'])
      c.removeAgentsSection('server')
    },
  }),
  api: r({
    name: 'api',
    package: '@kitr/api',
    requires: ['server'],
    description:
      'Adonis-style router, controllers, validators, middleware; typed client with no codegen; OpenAPI via api:sync.',
    configure(ctx, c) {
      const serverOnly = !('react' in { ...ctx.pkg.dependencies })
      c.installPackages(['@kitr/api'])
      c.addPackage('@kitr/api')
      ctx.write(
        'config/api.ts',
        `import { defineConfig } from 'kitr/api'\n\nexport default defineConfig({\n  prefix: '/api',\n  openapi: { path: 'openapi.json', title: '${ctx.pkg.name ?? 'app'} API', version: '0.1.0' },\n})\n`,
      )
      const routesPath = serverOnly ? 'start/routes.ts' : 'app/api/routes.ts'
      const controllersAlias = serverOnly ? '#controllers' : '#app/controllers'
      ctx.write(
        routesPath,
        `import { cors, defineRoutes } from 'kitr/api'\nimport HealthController from '${controllersAlias}/health_controller'\n\nexport const routes = defineRoutes((router) =>\n  router.group({ prefix: '/api', middleware: [cors()] }, (api) =>\n    api.get('/health', [HealthController, 'show'], { name: 'health' }),\n    // api.resource('projects', () => import('${controllersAlias}/projects_controller'))\n  ),\n)\n\n/** Pass to createApiClient<AppRoutes>() on the client. */\nexport type AppRoutes = typeof routes.$types\n`,
      )
      ctx.write(
        `${serverOnly ? 'app' : 'app'}/controllers/health_controller.ts`,
        `import type { HttpContext } from 'kitr/api'\n\nexport default class HealthController {\n  async show({ requestId }: HttpContext) {\n    return { ok: true, requestId }\n  }\n}\n`,
      )
      if (!serverOnly) {
        ctx.write(
          'app/routes/api.$.ts',
          `import { createFileRoute } from '@tanstack/react-router'\nimport { server } from '#app/api/server'\n\n/** Every /api/* request goes to the kitr router. */\nexport const Route = createFileRoute('/api/$')({\n  server: {\n    handlers: {\n      ANY: ({ request }) => server.fetch(request),\n    },\n  },\n})\n`,
        )
        ctx.write(
          'app/api/client.ts',
          `import { createApiClient } from 'kitr/api/client'\nimport type { AppRoutes } from './routes'\n\n/** Typed, no codegen: route names, params, bodies and outputs come from the router. */\nexport const api = createApiClient<AppRoutes>({ baseUrl: typeof window === 'undefined' ? \`http://localhost:\${process.env.PORT ?? 3000}\` : '' })\n`,
        )
      }
      c.addAgentsSection(
        'api',
        `- Routes: \`${routesPath}\` (\`defineRoutes\`), controllers in \`app/controllers/<name>_controller.ts\` (\`kitr make:controller <name> --resource\`). Validators go in \`static validation = { store: { body: schema } }\`.\n- Actions are for this app's own UI; API routes are for anything else (mobile, partners, webhooks) or when you want REST + OpenAPI.\n- The client is typed from \`typeof routes.$types\`; call \`registerRoutes(api, routes.toJSON())\` or use \`kitr api:sync\` to write the route table and openapi.json.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/api')
      c.removePackages(['@kitr/api'])
      c.removeAgentsSection('api')
    },
  }),
  actions: r({
    name: 'actions',
    package: '@kitr/actions',
    requires: ['server'],
    client: true,
    description:
      'defineAction over TanStack Start server functions: validation, middleware, one error shape, cache effects.',
    configure(ctx, c) {
      c.installPackages(['@kitr/actions', '@tanstack/react-start'])
      c.addPackage('@kitr/actions')
      ctx.write('app/actions/.gitkeep', '')
      c.addAgentsSection(
        'actions',
        `- \`kitr make:action <feature>/<name>\` writes \`app/actions/<feature>/<name>.ts\` with \`defineAction('<feature>.<name>', { input, effects, handler })\`.\n- Call actions from anywhere: \`await updateProject(input)\`; in components use \`useKitrMutation(defineMutation(updateProject.mutation()))\`. GET actions expose \`.query()\` for loaders.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/actions')
      c.removePackages(['@kitr/actions'])
      c.removeAgentsSection('actions')
    },
  }),
  ssr: r({
    name: 'ssr',
    package: '@kitr/ssr',
    requires: ['server'],
    client: true,
    description: 'Per-route rendering defaults, seo() head helpers, prerender list, cache headers.',
    configure(ctx, c) {
      c.installPackages(['@kitr/ssr'])
      c.addPackage('@kitr/ssr')
      ctx.write(
        'config/ssr.ts',
        `import { defineConfig } from 'kitr/ssr'\n\nexport default defineConfig({\n  ssr: true,\n  prerender: [],\n  site: { name: '${ctx.pkg.name ?? 'My app'}' },\n})\n`,
      )
      c.addAgentsSection(
        'ssr',
        `- Routes render on the server by default; use \`...ssrRoute('data-only')\` for heavy, non-SEO pages. \`head: () => seo({ title, description })\` from \`kitr/ssr\` writes meta tags.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/ssr')
      c.removePackages(['@kitr/ssr'])
      c.removeAgentsSection('ssr')
    },
  }),
  socket: r({
    name: 'socket',
    package: '@kitr/socket',
    requires: ['server'],
    description:
      'Typed channels over native WebSocket: partysocket client, crossws server. Events feed the query cache.',
    configure(ctx, c) {
      const serverOnly = !('react' in { ...ctx.pkg.dependencies })
      c.installPackages(['@kitr/socket', 'crossws', ...(serverOnly ? [] : ['partysocket'])])
      c.addPackage('@kitr/socket')
      ctx.write(
        'config/socket.ts',
        `import { defineConfig } from 'kitr/socket'\n\nexport default defineConfig({\n  path: '/ws',\n  transport: 'websocket',\n})\n`,
      )
      ctx.write(
        'app/channels/example.ts',
        `import { defineChannel } from 'kitr/socket'\n\n/** One definition for both ends. The client applies \`effects\`; the server checks \`authorize\`. */\nexport const exampleChannel = defineChannel<{ room: string }>({\n  name: 'example',\n  events: {\n    message: { effects: () => ({ invalidate: [['messages']] }) },\n  },\n  authorize: () => true,\n})\n`,
      )
      ctx.write(
        serverOnly ? 'start/socket.ts' : 'app/api/socket.ts',
        `import { createSocketServer } from 'kitr/socket/server'\nimport { exampleChannel } from '${serverOnly ? '#app' : '#app'}/channels/example'\n\nexport const sockets = createSocketServer({\n  channels: [exampleChannel],\n  // authorize: (request) => verify(request.headers.get('authorization')),\n})\n// In server.ts: sockets.attach(server, '/ws'); from a controller: sockets.use(exampleChannel, { room }).emit('message', data)\n`,
      )
      c.addAgentsSection(
        'socket',
        `- Channels are defined once in \`app/channels/*.ts\` with \`defineChannel\`. Server emits with \`sockets.use(channel, params).emit(event, data)\`; the client subscribes with \`useSubscription(channel(socket, def).subscription(), params)\` and events update the query cache via \`effects\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/socket')
      c.removePackages(['@kitr/socket', 'crossws', 'partysocket'])
      c.removeAgentsSection('socket')
    },
  }),
  'socket.io': r({
    name: 'socket.io',
    package: '@kitr/socket.io',
    requires: ['server', 'socket'],
    description: 'The same channels over Socket.IO, for rooms, fallbacks and the Redis adapter.',
    configure(ctx, c) {
      const serverOnly = !('react' in { ...ctx.pkg.dependencies })
      c.installPackages([
        '@kitr/socket.io',
        'socket.io',
        ...(serverOnly ? [] : ['socket.io-client']),
      ])
      c.addPackage('@kitr/socket.io')
      c.addAgentsSection(
        'socket.io',
        `- Transport swap: \`createSocketIoClient()\` from \`kitr/socket.io\` replaces \`createSocketClient()\`; the server uses \`attachSocketIo(io, { channels })\` on the Node http server returned by \`server.listen()\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/socket.io')
      c.removePackages(['@kitr/socket.io', 'socket.io', 'socket.io-client'])
      c.removeAgentsSection('socket.io')
    },
  }),
  db: r({
    name: 'db',
    package: '@kitr/db',
    requires: ['server'],
    description: 'Bind any ORM as `db` with connect/disconnect in the lifecycle. No ORM shipped.',
    configure(ctx, c) {
      c.installPackages(['@kitr/db'])
      c.addProvider('@kitr/db')
      c.addPackage('@kitr/db')
      c.addEnv({ DATABASE_URL: 'postgres://localhost:5432/app' }, 'Database')
      ctx.write(
        'config/db.ts',
        `import { defineDb } from 'kitr/db'\n\n// Example with Drizzle + postgres.js: \`pnpm add drizzle-orm postgres\`\n// import { drizzle } from 'drizzle-orm/postgres-js'\n// import postgres from 'postgres'\n\nexport default defineDb({\n  connect: async () => {\n    // const client = postgres(process.env.DATABASE_URL!)\n    // return drizzle(client)\n    return {} as unknown\n  },\n  // disconnect: (db) => db.$client.end(),\n})\n`,
      )
      c.addAgentsSection(
        'db',
        `- \`config/db.ts\` connects the ORM; controllers and actions read it with \`useDb<AppDb>(ctx.app)\` or \`ctx.app.container.use('db')\`. Migrations are the ORM's own tooling.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/db')
      c.removePackage('@kitr/db')
      c.removePackages(['@kitr/db'])
      c.removeAgentsSection('db')
    },
  }),
  testing: r({
    name: 'testing',
    package: '@kitr/testing',
    description: 'Vitest, Testing Library, renderWithKitr and a request client for API tests.',
    configure(ctx, c) {
      const serverOnly = !('react' in { ...ctx.pkg.dependencies })
      c.installPackages([
        { name: '@kitr/testing', dev: true },
        { name: 'vitest', dev: true },
        ...(serverOnly
          ? []
          : [
              { name: '@testing-library/react', dev: true },
              { name: '@testing-library/dom', dev: true },
              { name: 'happy-dom', dev: true },
            ]),
      ])
      c.addPackage('@kitr/testing')
      ctx.write(
        'vitest.config.ts',
        `import { defineConfig } from 'vitest/config'\n${serverOnly ? '' : "import { kitr } from 'kitr/vite'\n"}\nexport default defineConfig({\n${serverOnly ? '' : '  plugins: [kitr({ react: true, tailwind: false })],\n'}  test: {\n    environment: '${serverOnly ? 'node' : 'happy-dom'}',\n    include: ['app/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],\n  },\n})\n`,
      )
      ctx.write(
        'test/example.test.ts',
        serverOnly
          ? `import { createTestClient } from 'kitr/testing'\nimport { expect, it } from 'vitest'\nimport { server } from '../server'\n\nit('answers health', async () => {\n  const client = createTestClient(server)\n  const res = await client.get<{ ok: boolean }>('/api/health')\n  expect(res.status).toBe(200)\n  expect(res.body.ok).toBe(true)\n})\n`
          : `import { expect, it } from 'vitest'\n\nit('runs', () => {\n  expect(1 + 1).toBe(2)\n})\n`,
      )
      c.addAgentsSection(
        'testing',
        `- \`${ctx.pm} test\` runs Vitest. Components: \`renderWithKitr(<X />, { app, queryData })\` from \`kitr/testing/react\`. APIs: \`createTestClient(server).get('/api/x')\`. No running backend is needed.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/testing')
      c.removePackages(['@kitr/testing'])
      c.removeAgentsSection('testing')
    },
  }),
  mocks: r({
    name: 'mocks',
    package: '@kitr/mocks',
    client: true,
    description:
      'MSW handlers from route tables and contracts, for dev without a backend and for tests.',
    configure(ctx, c) {
      c.installPackages(['@kitr/mocks', { name: 'msw', dev: true }])
      c.addPackage('@kitr/mocks')
      ctx.write(
        'app/mocks/handlers.ts',
        `import { HttpResponse, http } from 'kitr/mocks'\n\nexport const handlers = [\n  http.get('*/me', () => HttpResponse.json({ id: 'u1', email: 'dev@example.com', role: 'admin' })),\n]\n`,
      )
      ctx.write(
        'app/mocks/browser.ts',
        `import { setupBrowserMocks } from 'kitr/mocks'\nimport { handlers } from './handlers'\n\n/** Call from main.tsx in dev: \`if (import.meta.env.DEV && import.meta.env.VITE_MOCKS) await enableMocks()\` */\nexport const enableMocks = () => setupBrowserMocks(handlers)\n`,
      )
      c.addEnv({ VITE_MOCKS: 'false' }, 'Set true to serve app/mocks/handlers.ts in the browser')
      c.addAgentsSection(
        'mocks',
        `- Mocks live in \`app/mocks/handlers.ts\` (MSW). \`VITE_MOCKS=true\` enables them in dev; tests use \`setupNodeMocks(handlers)\`. Mock a kitr route table with \`mockRoutes(routes.toJSON(), baseUrl, { 'projects.index': () => [...] })\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/mocks')
      c.removePackages(['@kitr/mocks', 'msw'])
      c.removeAgentsSection('mocks')
    },
  }),
  i18n: r({
    name: 'i18n',
    package: '@kitr/i18n',
    client: true,
    description: 'react-i18next with typed keys, locale detection and a provider.',
    configure(ctx, c) {
      c.installPackages(['@kitr/i18n', 'i18next', 'react-i18next'])
      c.addProvider('@kitr/i18n')
      c.addPackage('@kitr/i18n')
      ctx.write(
        'app/locales/en.ts',
        `export default {\n  common: {\n    hello: 'Hello, {{name}}',\n    save: 'Save',\n  },\n} as const\n`,
      )
      ctx.write(
        'config/i18n.ts',
        `import { defineConfig } from 'kitr/i18n'\nimport en from '#app/locales/en'\n\nexport default defineConfig({\n  resources: { en },\n  defaultLocale: 'en',\n  defaultNS: 'common',\n})\n`,
      )
      c.addAgentsSection(
        'i18n',
        `- Strings live in \`app/locales/<lang>.ts\`. Components: \`const { t } = useTranslation()\` from \`kitr/i18n\`; keys are typed from the English bundle.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/i18n')
      c.removePackage('@kitr/i18n')
      c.removePackages(['@kitr/i18n', 'i18next', 'react-i18next'])
      c.removeAgentsSection('i18n')
    },
  }),
  ...addonRecipes,
}

export const recipeNames = Object.keys(recipes)

/** Resolve a recipe list with its `requires` closure, in dependency order. */
export function resolveRecipes(names: string[], installed: string[]): Recipe[] {
  const out: Recipe[] = []
  const seen = new Set<string>()
  const visit = (name: string) => {
    if (seen.has(name)) return
    const recipe = recipes[name]
    if (!recipe) throw new Error(`Unknown package "${name}". Known: ${recipeNames.join(', ')}`)
    seen.add(name)
    for (const dep of recipe.requires ?? [])
      if (!installed.includes(recipes[dep]?.package ?? dep)) visit(dep)
    out.push(recipe)
  }
  for (const n of names) visit(n)
  return out
}

/** The root route for TanStack Start: renders the document, head tags and scripts. */
function startRootRoute(cssImports: string[]): string {
  const imports = cssImports.map((c, i) => `import css${i} from '${c}?url'`).join('\n')
  const links = cssImports.map((_, i) => `{ rel: 'stylesheet', href: css${i} }`).join(', ')
  return `import type { KitrRouterContext } from 'kitr/router'
import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext } from 'kitr/router'
import type { ReactNode } from 'react'
${imports}

export const Route = createRootRouteWithContext<KitrRouterContext>()({
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    links: [${links}],
  }),
  component: RootLayout,
})

function RootLayout() {
  return (
    <RootDocument>
      <nav style={{ display: 'flex', gap: 12, padding: 12 }}>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      <Outlet />
    </RootDocument>
  )
}

/** The HTML shell. Start streams it on the server and hydrates it on the client. */
function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
`
}
