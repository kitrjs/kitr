import { definePackage, naming } from '@kitr/core/package'

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

/**
 * `kitr add router`: TanStack Router file routes under app/routes, rendered by TanStack Start
 * on every UI platform, with the router, the client entry and a first page.
 */
export default definePackage({
  name: 'router',
  requires: ['react'],
  client: true,
  add(ctx) {
    ctx.deps.add(
      '@tanstack/react-router',
      '@tanstack/react-start',
      { name: '@tanstack/router-plugin', dev: true },
      { name: '@tanstack/react-router-devtools', dev: true },
    )
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
    ctx.agents.add(
      'router',
      `- Routes are files in \`app/routes\` (TanStack Router file routes). \`app/routeTree.gen.ts\` is generated; never edit it.\n- In route files, import \`createFileRoute\` / \`createLazyFileRoute\` from \`@tanstack/react-router\` (the route generator owns that import). Everything else comes from \`kitr/router\`.\n- The root route (\`app/routes/__root.tsx\`) renders the HTML document: TanStack Start streams it on the server (web \`ssr\`), prerenders it (\`static\`) or ships one shell (\`spa\`, desktop, mobile). Keep it platform-neutral.`,
    )
  },
  remove(ctx) {
    ctx.deps.remove(
      '@tanstack/react-router',
      '@tanstack/react-start',
      '@tanstack/router-plugin',
      '@tanstack/react-router-devtools',
    )
    ctx.agents.remove('router')
  },
  doctor(project) {
    const routes = project.rc.directories.routes ?? 'app/routes'
    const app = project.rc.directories.app ?? 'app'
    if (!project.exists(routes) || project.exists(`${app}/routeTree.gen.ts`)) return []
    return [
      {
        level: 'info',
        message: `${app}/routeTree.gen.ts not generated yet`,
        fix: 'kitr dev <name> (TanStack Router writes it on first start)',
      },
    ]
  },
  generators: {
    route: {
      description: 'Create a page route in app/routes',
      target: (name, project) => {
        // `projects/index` → file app/routes/projects/index.tsx, route path '/projects/' (TanStack's index route form).
        const raw = name.startsWith('/') ? name : `/${name}`
        const isIndex = raw === '/' || raw.endsWith('/index')
        const path = isIndex ? (raw === '/' ? '/' : `${raw.slice(0, -'/index'.length)}/`) : raw
        const file = `${project.rc.directories.routes ?? 'app/routes'}/${raw === '/' ? 'index' : raw.slice(1).replace(/:(\w+)/g, '$$$1')}.tsx`
        const base =
          raw
            .split('/')
            .filter((s) => s && s !== 'index')
            .pop()
            ?.replace(/[:$]/g, '') || 'home'
        return { file, vars: { path, name: base } }
      },
      stub: ({ path, name }) => `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('${path}')({
  // loader: ({ context }) => context.queryClient.ensureQueryData(${naming.camel(name)}Query.options()),
  component: ${naming.pascal(name)}Page,
})

function ${naming.pascal(name)}Page() {
  return (
    <div>
      <h1>${naming.pascal(name)}</h1>
    </div>
  )
}
`,
    },
  },
  wraps: { '@tanstack/react-router': 'kitr/router' },
  eject: { 'kitr/router': '@tanstack/react-router (+ your own context/guards)' },
  vite: { start: true, optimizeDeps: ['@tanstack/react-router', '@tanstack/react-start'] },
})
