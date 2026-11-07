import type { ProjectContext } from './context'
import { type Recipe, r } from './recipe'
import { addonRecipes } from './recipes-addons'

export type { Recipe } from './recipe'

export const recipes: Record<string, Recipe> = {
  react: r({
    name: 'react',
    package: '@kitr/react',
    client: true,
    description:
      'React, the kitr app object and the provider tree (`KitrProvider`). Every UI platform needs it.',
    configure(ctx, c) {
      c.installPackages([
        '@kitr/react',
        'react',
        'react-dom',
        { name: '@vitejs/plugin-react', dev: true },
        { name: '@types/react', dev: true },
        { name: '@types/react-dom', dev: true },
      ])
      c.addPackage('@kitr/react')
      ctx.write(
        'app/env.ts',
        `import { createEnv, env as e } from 'kitr/env'\n\n/** Validated at startup. Public vars (VITE_*) ship to the browser; server vars throw if read there. */\nexport const env = createEnv({\n  public: {\n    VITE_APP_NAME: e.string({ default: '${ctx.pkg.name ?? 'app'}' }),\n  },\n  server: {},\n})\n`,
      )
      ctx.write(
        'app/app.ts',
        `import { createApp } from 'kitr/app'\nimport { config } from 'virtual:kitr/config'\nimport { providers } from 'virtual:kitr/providers'\nimport { env } from './env'\n\n/** One app object: providers from kitrrc.ts, config from config/*.ts, both as static imports. */\nexport const app = createApp({ providers, config, env })\n`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/react')
      c.removePackages([
        '@kitr/react',
        'react',
        'react-dom',
        '@vitejs/plugin-react',
        '@types/react',
        '@types/react-dom',
      ])
    },
  }),
  router: r({
    name: 'router',
    package: '@kitr/router',
    requires: ['react'],
    client: true,
    description:
      'TanStack Router file routes under app/routes, rendered by TanStack Start on every UI platform.',
    configure(ctx, c) {
      c.installPackages([
        '@kitr/router',
        '@tanstack/react-router',
        '@tanstack/react-start',
        { name: '@tanstack/router-plugin', dev: true },
        { name: '@tanstack/react-router-devtools', dev: true },
      ])
      c.addPackage('@kitr/router')
      ctx.write(
        'app/router.tsx',
        `import { createKitrRouter } from 'kitr/router'\nimport { app } from './app'\nimport { routeTree } from './routeTree.gen'\n\nexport function getRouter() {\n  return createKitrRouter({ routeTree, app })\n}\n\ndeclare module '@tanstack/react-router' {\n  interface Register {\n    router: ReturnType<typeof getRouter>\n  }\n}\n`,
      )
      // Boot providers before hydrating, so the first client render matches the server's HTML.
      ctx.write(
        'app/client.tsx',
        `import { StartClient } from '@tanstack/react-start/client'\nimport { StrictMode, startTransition } from 'react'\nimport { hydrateRoot } from 'react-dom/client'\nimport { app } from './app'\n\n/** Start's client entry, with the kitr app booted first so providers are ready when the tree hydrates. */\napp.boot().then(() => {\n  startTransition(() => {\n    hydrateRoot(\n      document,\n      <StrictMode>\n        <StartClient />\n      </StrictMode>,\n    )\n  })\n})\n`,
      )
      ctx.write('app/routes/__root.tsx', startRootRoute(['kitr/theme/styles.css']))
      ctx.write(
        'app/routes/index.tsx',
        `import { createFileRoute } from '@tanstack/react-router'\n\nexport const Route = createFileRoute('/')({\n  component: HomePage,\n})\n\nfunction HomePage() {\n  return (\n    <main style={{ padding: 24 }}>\n      <h1>${ctx.pkg.name ?? 'app'}</h1>\n      <p>Edit <code>app/routes/index.tsx</code>. Add a page with <code>kitr make:route</code>.</p>\n    </main>\n  )\n}\n`,
      )
      ctx.write(
        'app/routes/about.tsx',
        `import { createFileRoute } from '@tanstack/react-router'\n\nexport const Route = createFileRoute('/about')({\n  component: () => <main style={{ padding: 24 }}>About</main>,\n})\n`,
      )
      c.addAgentsSection(
        'router',
        `- Routes are files in \`app/routes\` (TanStack Router file routes). \`app/routeTree.gen.ts\` is generated; never edit it.\n- In route files, import \`createFileRoute\` / \`createLazyFileRoute\` from \`@tanstack/react-router\` (the route generator owns that import). Everything else comes from \`kitr/router\`.\n- The root route (\`app/routes/__root.tsx\`) renders the HTML document: TanStack Start streams it on the server (web \`ssr\`), prerenders it (\`static\`) or ships one shell (\`spa\`, desktop, mobile). Keep it platform-neutral.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/router')
      c.removePackages([
        '@kitr/router',
        '@tanstack/react-router',
        '@tanstack/react-start',
        '@tanstack/router-plugin',
        '@tanstack/react-router-devtools',
      ])
      c.removeAgentsSection('router')
    },
  }),
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
  tailwind: r({
    name: 'tailwind',
    package: '@kitr/tailwind',
    requires: ['react'],
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
        `@import 'tailwindcss';\n@import 'kitr/tailwind/preset.css';\n@import 'kitr/theme/styles.css';\n\n@source '../';\n`,
      )
      c.replaceCssImport('app/routes/__root.tsx', 'kitr/theme/styles.css', '#app/styles/app.css')
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
  theme: r({
    name: 'theme',
    package: '@kitr/theme',
    requires: ['react'],
    client: true,
    description:
      'Design tokens and light/dark/system theming with no flash on load, cookie-backed for SSR, synced to native chrome. Components come from the registry (`kitr ui add`).',
    configure(ctx, c) {
      c.installPackages(['@kitr/theme'])
      c.addProvider('@kitr/theme/provider')
      c.addPackage('@kitr/theme')
      ctx.write(
        'config/theme.ts',
        `import { defineConfig } from 'kitr/theme'\n\nexport default defineConfig({\n  default: 'system',\n  // Window chrome / <meta name="theme-color"> per theme.\n  colors: { light: '#ffffff', dark: '#0a0a0a' },\n  // Any shadcn-compatible registry for \`kitr ui add\`. Default: kitr's.\n  // registry: 'https://raw.githubusercontent.com/kitrjs/kitr/main/registry/dist',\n  componentsDir: 'app/components/ui',\n})\n`,
      )
      ctx.write(
        'app/styles/tokens.css',
        `/* Override kitr tokens here. See kitr/theme/styles.css for the full list. */\n:root {\n  /* --kitr-color-primary: oklch(55% 0.2 262); */\n}\n`,
      )
      c.addAgentsSection(
        'theme',
        `- Theme: \`useTheme()\` from \`kitr/theme\` (\`theme\`, \`resolved\`, \`setTheme\`, \`toggle\`); \`data-theme="light|dark"\` on <html>. Put \`<ThemeScript />\` in the document head to avoid a flash.\n- Colours and radii come from the \`--kitr-*\` variables (\`kitr/theme/styles.css\`, overrides in \`app/styles/tokens.css\`); never hard-code them. Plain CSS helpers: \`pick()\`, \`vars()\`, \`dataAttrs()\` from \`kitr/theme\`.\n- Components live in \`app/components/ui/\` and are owned by the app: add more with \`kitr ui add <name>\` (shadcn-compatible registry); toasts via \`kitr ui add sonner\`.\n- Icons: Hugeicons in the stroke-rounded style through \`<Icon icon={Add01Icon} />\` from \`#components/ui/icon\` (\`kitr ui add icon\`), icons from \`@hugeicons/core-free-icons\`. No other icon set, no emoji or glyphs as icons.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/theme/provider')
      c.removePackage('@kitr/theme')
      c.removePackages(['@kitr/theme'])
      c.removeAgentsSection('theme')
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
        `import { defineAbilities } from 'kitr/auth'\n\nexport interface User {\n  id: string\n  email: string\n  role: 'admin' | 'member'\n}\n\nexport const abilities = defineAbilities({\n  'projects.update': (user: User, project: { ownerId: string }) => user.role === 'admin' || project.ownerId === user.id,\n})\n`,
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
      'The server runtime on h3: request context, errors, lifecycle. Run it as a platform: `kitr add server api`.',
    configure(ctx, c) {
      c.installPackages(['@kitr/server', 'h3', 'srvx'])
      c.addPackage('@kitr/server')
      ctx.write(
        'config/server.ts',
        `import { defineConfig } from 'kitr/server'\n\nexport default defineConfig({\n  healthPath: '/healthz',\n  bodyLimit: 1024 * 1024,\n})\n`,
      )
      c.addEnv({ LOG_LEVEL: 'info' }, 'Server')
      if (!Object.values(ctx.readRc().platforms).some((p) => p.factory === 'server'))
        ctx.log.info('Run the server as a platform: `kitr add server api` (writes server/main.ts).')
      c.addAgentsSection(
        'server',
        `- Server code lives under \`server/\` and never imports React. Services come from the request-scoped container (\`useRequestApp()\`), logs from \`ctx.logger\`.\n- \`server/main.ts\` (written by the server platform) exports \`server\`; providers' \`ready\`/\`shutdown\` run on \`server.listen()\`. A web platform in \`ssr\` mode answers \`/api/*\` through the same object via \`app/routes/api.$.ts\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/server')
      c.removePackages(['@kitr/server', 'h3', 'srvx'])
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
      const serverOnly = !hasReact(ctx)
      c.installPackages(['@kitr/api'])
      c.addPackage('@kitr/api')
      ctx.write(
        'config/api.ts',
        `import { defineConfig } from 'kitr/api'\n\nexport default defineConfig({\n  prefix: '/api',\n  openapi: { path: 'openapi.json', title: '${ctx.pkg.name ?? 'app'} API', version: '0.1.0' },\n})\n`,
      )
      ctx.write(
        'server/routes.ts',
        `import { cors, defineRoutes } from 'kitr/api'\nimport HealthController from '#server/controllers/health_controller'\n\nexport const routes = defineRoutes((router) =>\n  router.group({ prefix: '/api', middleware: [cors()] }, (api) =>\n    api.get('/health', [HealthController, 'show'], { name: 'health' }),\n    // api.resource('projects', () => import('#server/controllers/projects_controller'))\n  ),\n)\n\n/** Pass to createApiClient<AppRoutes>() on the client. */\nexport type AppRoutes = typeof routes.$types\n`,
      )
      ctx.write(
        'server/controllers/health_controller.ts',
        `import type { HttpContext } from 'kitr/api'\n\nexport default class HealthController {\n  async show({ requestId }: HttpContext) {\n    return { ok: true, requestId }\n  }\n}\n`,
      )
      // A server platform added earlier wrote server/main.ts without the router; mount it now.
      if (ctx.exists('server/main.ts')) {
        const main = ctx.read('server/main.ts')
        if (!main.includes('mountRoutes'))
          ctx.write(
            'server/main.ts',
            main
              .replace(
                "import { createServer } from 'kitr/server'\n",
                "import { createServer } from 'kitr/server'\nimport { mountRoutes } from 'kitr/api'\n",
              )
              .replace(
                /\nimport rc from '\.\.\/kitrrc'\n/,
                "\nimport rc from '../kitrrc'\nimport { routes } from './routes'\n",
              )
              .replace(
                /(export const server = createServer\([^\n]*\)\n)/,
                '$1mountRoutes(server, routes)\n',
              ),
            { overwrite: true },
          )
      }
      if (!serverOnly) {
        ctx.write(
          'app/api/client.ts',
          `import { createApiClient } from 'kitr/api/client'\nimport type { AppRoutes } from '#server/routes'\n\n/** Typed, no codegen: route names, params, bodies and outputs come from the router. */\nexport const api = createApiClient<AppRoutes>({ baseUrl: typeof window === 'undefined' ? \`http://localhost:\${process.env.PORT ?? 3000}\` : '' })\n`,
        )
      }
      c.addAgentsSection(
        'api',
        `- Routes: \`server/routes.ts\` (\`defineRoutes\`), controllers in \`server/controllers/<name>_controller.ts\` (\`kitr make:controller <name> --resource\`). Validators go in \`static validation = { store: { body: schema } }\`.\n- Actions are for this app's own UI; API routes are for anything else (mobile, partners, webhooks) or when you want REST + OpenAPI.\n- The client is typed from \`typeof routes.$types\`; call \`registerRoutes(api, routes.toJSON())\` or use \`kitr api:sync\` to write the route table and openapi.json.`,
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
      c.installPackages(['@kitr/actions'])
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
  seo: r({
    name: 'seo',
    package: '@kitr/seo',
    client: true,
    description:
      'seo() head helpers, JSON-LD, per-route rendering defaults, prerender list, robots and sitemap, cache headers.',
    configure(ctx, c) {
      c.installPackages(['@kitr/seo'])
      c.addPackage('@kitr/seo')
      ctx.write(
        'config/seo.ts',
        `import { defineConfig } from 'kitr/seo'\n\nexport default defineConfig({\n  site: { name: '${ctx.pkg.name ?? 'My app'}' },\n  // Routes prerendered at build time by a web platform in ssr mode; a static web platform prerenders everything.\n  prerender: [],\n})\n`,
      )
      c.addAgentsSection(
        'seo',
        `- \`head: () => seo({ title, description })\` from \`kitr/seo\` writes title, Open Graph, Twitter and canonical tags; \`jsonLd({...})\` adds structured data. Site defaults live in \`config/seo.ts\`.\n- Use \`...ssrRoute('data-only')\` for heavy, non-SEO pages; \`cacheHeaders({ sMaxAge })\` for the CDN.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/seo')
      c.removePackages(['@kitr/seo'])
      c.removeAgentsSection('seo')
    },
  }),
  realtime: r({
    name: 'realtime',
    package: '@kitr/realtime',
    requires: ['server'],
    description:
      'Typed channels with interchangeable transports: WebSocket (default), Socket.IO or SSE. Events feed the query cache.',
    configure(ctx, c) {
      const serverOnly = !hasReact(ctx)
      c.installPackages(['@kitr/realtime', 'crossws', ...(serverOnly ? [] : ['partysocket'])])
      c.addPackage('@kitr/realtime')
      ctx.write(
        'config/realtime.ts',
        `import { defineConfig } from 'kitr/realtime'\n\nexport default defineConfig({\n  // websocket (default), socket.io or sse: the channels and hooks stay the same.\n  transport: 'websocket',\n  path: '${serverOnly ? '/ws' : '/api/ws'}',\n})\n`,
      )
      ctx.write(
        'app/channels/example.ts',
        `import { defineChannel } from 'kitr/realtime'\n\n/** One definition for both ends. The client applies \`effects\`; the server checks \`authorize\`. */\nexport const exampleChannel = defineChannel<{ room: string }>({\n  name: 'example',\n  events: {\n    message: { effects: () => ({ invalidate: [['messages']] }) },\n  },\n  authorize: () => true,\n})\n`,
      )
      ctx.write(
        'server/realtime.ts',
        `import { createRealtimeServer } from 'kitr/realtime/server'\nimport { exampleChannel } from '#app/channels/example'\n\n/** Attached in server/main.ts; from a controller: realtime.use(exampleChannel, { room }).emit('message', data) */\nexport const realtime = createRealtimeServer({\n  channels: [exampleChannel],\n  // authorize: (request) => verify(request.headers.get('authorization')),\n})\n`,
      )
      attachRealtime(ctx)
      if (!serverOnly)
        ctx.write(
          'app/realtime.ts',
          `import { createRealtimeClient, type SocketTransport } from 'kitr/realtime'\nimport realtimeConfig from '#config/realtime'\n\nlet transport: SocketTransport | undefined\n\n/** One connection per tab, opened on first use (so nothing connects during SSR). */\nexport function realtime(): SocketTransport {\n  transport ??= createRealtimeClient(realtimeConfig)\n  return transport\n}\n`,
        )
      c.addAgentsSection(
        'realtime',
        `- Channels are defined once in \`app/channels/*.ts\` with \`defineChannel\`. The server emits with \`realtime.use(channel, params).emit(event, data)\` (server/realtime.ts); components subscribe with \`useChannel(realtime(), channel, params)\` from \`kitr/realtime/react\` and events update the query cache via \`effects\`.\n- Switch transports in \`config/realtime.ts\`: \`socket.io\` (rooms, adapters; client from \`kitr/realtime/socket.io\`) or \`sse\` (plain HTTP, no upgrade; server from \`kitr/realtime/sse/server\`).`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/realtime')
      c.removePackages([
        '@kitr/realtime',
        'crossws',
        'partysocket',
        'socket.io',
        'socket.io-client',
      ])
      c.removeAgentsSection('realtime')
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
      const serverOnly = !hasReact(ctx)
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
          ? `import { createTestClient } from 'kitr/testing'\nimport { expect, it } from 'vitest'\nimport { server } from '../server/main'\n\nit('answers health', async () => {\n  const client = createTestClient(server)\n  const res = await client.get<{ ok: boolean }>('/api/health')\n  expect(res.status).toBe(200)\n  expect(res.body.ok).toBe(true)\n})\n`
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

/** React is present once its recipe ran, even before package.json is flushed. */
export function hasReact(ctx: ProjectContext): boolean {
  return 'react' in { ...ctx.pkg.dependencies } || ctx.readRc().packages.includes('@kitr/react')
}

/** Add `realtime.attach(server, path)` to server/main.ts when the server platform wrote it first. */
export function attachRealtime(ctx: ProjectContext) {
  if (!ctx.exists('server/main.ts')) return
  const main = ctx.read('server/main.ts')
  if (main.includes('realtime.attach')) return
  const path = ctx.exists('config/realtime.ts')
    ? (ctx.read('config/realtime.ts').match(/path\s*:\s*['"]([^'"]+)['"]/)?.[1] ?? '/ws')
    : '/ws'
  const serverOnly = !hasReact(ctx)
  const importLine = serverOnly
    ? "import { realtime } from './realtime'\n"
    : "import { realtime } from '#server/realtime'\n"
  const next = main
    .replace(/(import \{ createServer \} from 'kitr\/server'\n)/, `$1${importLine}`)
    .replace(
      /(export const server = createServer\([^\n]*\)\n(?:mountRoutes\(server, routes\)\n)?)/,
      `$1// WebSocket upgrades on ${path}, next to the routes.\nrealtime.attach(server, '${path}')\n`,
    )
  if (next !== main) ctx.write('server/main.ts', next, { overwrite: true })
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
