import { definePackage, naming } from '@kitr/core/package'

/** `app/document.tsx`: the HTML shell and head tags every page renders inside. */
function documentFile(cssImports: string[]): string {
  const imports = cssImports.map((c, i) => `import css${i} from '${c}?url'`).join('\n')
  const links = cssImports.map((_, i) => `{ rel: 'stylesheet', href: css${i} }`).join(', ')
  return `import { HeadContent, Link, Outlet, Scripts } from '@kitr/router'
${imports}

/** Head tags for every page. Pages add their own through \`head\` in their route options. */
export function head() {
  return {
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    links: [${links}],
  }
}

/** The HTML shell. Start streams it on the server and hydrates it on the client. */
export function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <nav style={{ display: 'flex', gap: 12, padding: 12 }}>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
`
}

/** `app/routes.ts`: the route table with the first pages. */
const routesFile = `import { defineRoutes } from 'kitr/app'
import router from '@kitr/router/routes'
import { head, RootDocument } from './document'

/**
 * Every page of the app, in one place. \`kitr make:page <path>\` appends to this chain; \`.group\`
 * nests paths, \`.layout\` wraps pages in a component without a path segment.
 */
export const routes = defineRoutes([router], (r) =>
  r
    .root({ head, component: RootDocument })
    .page('/', { lazy: () => import('./pages/home') })
    .page('/about', { lazy: () => import('./pages/about') }),
)

export type AppRoutes = typeof routes.$types
`

/** `app/router.tsx`: the TanStack router built from the table, registered for typed links. */
const routerFile = `import { createKitrRouter } from '@kitr/router'
import { app } from './app'
import { routes } from './routes'

export function getRouter() {
  return createKitrRouter({ routes, app })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
`

/** `app/client.tsx`: Start's client entry, with the kitr app booted before hydration. */
const clientFile = `import { StartClient } from '@tanstack/react-start/client'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { app } from './app'

/** Boot providers before hydrating, so the first client render matches the server's HTML. */
app.boot().then(() => {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    )
  })
})
`

/**
 * `kitr add router`: pages on the kitr route table (`.root`, `.page`, `.layout` from
 * `@kitr/router/routes`), compiled to a TanStack Router tree and rendered by TanStack Start on
 * every UI platform. No route files, no generated tree: `app/routes.ts` is the whole router.
 */
export default definePackage({
  name: 'router',
  requires: ['react'],
  client: true,
  routes: '@kitr/router/routes',
  add(ctx) {
    ctx.deps.add(
      '@tanstack/react-router',
      '@tanstack/react-start',
      { name: '@tanstack/router-plugin', dev: true },
      { name: '@tanstack/react-router-devtools', dev: true },
    )
    ctx.write('app/document.tsx', documentFile(['@kitr/theme/styles.css']))
    ctx.write('app/routes.ts', routesFile)
    // Idempotent: a table another package created first gets the pages methods added to its list.
    ctx.routes.extend('@kitr/router/routes')
    ctx.write(
      'app/pages/home.tsx',
      `export default function HomePage() {\n  return (\n    <main style={{ padding: 24 }}>\n      <h1>${ctx.pkg.name ?? 'app'}</h1>\n      <p>Edit <code>app/pages/home.tsx</code>. Add a page with <code>kitr make:page</code>.</p>\n    </main>\n  )\n}\n`,
    )
    ctx.write(
      'app/pages/about.tsx',
      `export default function AboutPage() {\n  return <main style={{ padding: 24 }}>About</main>\n}\n`,
    )
    ctx.write('app/router.tsx', routerFile)
    ctx.write('app/client.tsx', clientFile)
    ctx.agents.add(
      'router',
      `- Routes are code: \`app/routes.ts\` is one \`defineRoutes([router], (r) => r.root(...).page(...))\` chain. \`.page(path, { lazy })\` adds a page, \`.group(prefix, ...)\` nests paths, \`.layout(id, options, ...)\` wraps pages without a path segment. \`kitr make:page <path>\` writes the page file and appends the link.\n- Page components live in \`app/pages/\` and export a default component (or \`definePage({ component, pendingComponent })\`). Loaders, \`beforeLoad\` and \`head\` go on the route options in \`app/routes.ts\`; read loader data with \`getRouteApi('<path>')\` from \`@kitr/router\`.\n- \`app/document.tsx\` renders the HTML document: TanStack Start streams it on the server (web \`ssr\`), prerenders it (\`static\`) or ships one shell (\`spa\`, desktop, mobile). Keep it platform-neutral.\n- There is no \`app/routes/\` directory and no \`routeTree.gen.ts\`; \`@kitr/vite\` tells Start the tree comes from \`app/routes.ts\`.`,
    )
  },
  remove(ctx) {
    ctx.deps.remove(
      '@tanstack/react-router',
      '@tanstack/react-start',
      '@tanstack/router-plugin',
      '@tanstack/react-router-devtools',
    )
    ctx.routes.remove('@kitr/router/routes')
    const table = ctx.rc.directories.routeTable ?? `${ctx.rc.directories.app ?? 'app'}/routes.ts`
    if (ctx.exists(table) && /\.(root|page|layout)\(/.test(ctx.read(table)))
      ctx.log.warn(
        `${table} still has .root()/.page()/.layout() links; delete them or the file, the extension is gone.`,
      )
    ctx.agents.remove('router')
  },
  doctor(project) {
    const app = project.rc.directories.app ?? 'app'
    const table = project.rc.directories.routeTable ?? `${app}/routes.ts`
    const files = project.rc.directories.routes ?? `${app}/routes`
    if (project.exists(table) || project.exists(files)) return []
    return [
      {
        level: 'error',
        message: `${table} is missing: the router has no pages`,
        fix: 'kitr add router (or `kitr make:page home`)',
      },
    ]
  },
  generators: {
    page: {
      description: 'Create a page in app/pages and add it to app/routes.ts',
      target: (name, project) => {
        // `projects/$id` → app/pages/projects/id.tsx, route path '/projects/$id'. `:id` works too.
        const path = `/${name
          .replace(/^\/+/, '')
          .replace(/\/+$/, '')
          .replace(/:(\w+)/g, '$$$1')}`
        const segments = path.split('/').filter(Boolean)
        const fileSegments = segments.map((s) => s.replace(/^\$/, '')).filter(Boolean)
        const rel = fileSegments.length ? fileSegments.join('/') : 'home'
        const file = `${project.rc.directories.app ?? 'app'}/pages/${rel}.tsx`
        const base = fileSegments.map((s) => naming.pascal(s)).join('') || 'Home'
        return { file, vars: { path, name: base, module: `./pages/${rel}` } }
      },
      stub: ({
        path,
        name,
      }) => `// Route options (loader, beforeLoad, head) go on the \`.page('${path}', ...)\` link in app/routes.ts.
// Read what the loader returned: \`const route = getRouteApi('${path}')\` from '@kitr/router', then \`route.useLoaderData()\`.

export default function ${naming.pascal(name)}Page() {
  return (
    <div>
      <h1>${naming.pascal(name)}</h1>
    </div>
  )
}
`,
      after(ctx, { vars }) {
        if (ctx.routes.addPage(vars.path!, vars.module!)) return
        ctx.log.warn(
          `app/routes.ts is not a method chain; add \`.page('${vars.path}', { lazy: () => import('${vars.module}') })\` to it by hand.`,
        )
      },
    },
  },
  wraps: { '@tanstack/react-router': '@kitr/router' },
  eject: { '@kitr/router': '@tanstack/react-router (+ your own context/guards)' },
  vite: { start: true, optimizeDeps: ['@tanstack/react-router', '@tanstack/react-start'] },
})
