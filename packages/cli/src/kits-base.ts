import type { ProjectContext } from './context'
import { versionOf } from './versions'

export const baseReact = (ctx: ProjectContext, name: string) => {
  ctx.write(
    'package.json',
    `${JSON.stringify(
      {
        name,
        private: true,
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
          typecheck: 'tsc --noEmit',
          test: 'vitest run',
          lint: 'biome check .',
          kitr: 'kitr',
        },
        dependencies: {
          kitr: `^${ctx.kitrVersion}`,
          '@kitr/core': `^${ctx.kitrVersion}`,
          '@kitr/react': `^${ctx.kitrVersion}`,
          '@kitr/router': `^${ctx.kitrVersion}`,
          '@kitr/query': `^${ctx.kitrVersion}`,
          '@tanstack/react-router': versionOf('@tanstack/react-router'),
          '@tanstack/react-query': versionOf('@tanstack/react-query'),
          react: versionOf('react'),
          'react-dom': versionOf('react-dom'),
        },
        devDependencies: {
          '@kitr/vite': `^${ctx.kitrVersion}`,
          '@tanstack/router-plugin': versionOf('@tanstack/router-plugin'),
          '@tanstack/react-router-devtools': versionOf('@tanstack/react-router-devtools'),
          '@tanstack/react-query-devtools': versionOf('@tanstack/react-query-devtools'),
          '@vitejs/plugin-react': versionOf('@vitejs/plugin-react'),
          '@types/react': versionOf('@types/react'),
          '@types/react-dom': versionOf('@types/react-dom'),
          '@types/node': versionOf('@types/node'),
          '@biomejs/biome': versionOf('@biomejs/biome'),
          typescript: versionOf('typescript'),
          vite: versionOf('vite'),
          vitest: versionOf('vitest'),
        },
      },
      null,
      2,
    )}\n`,
  )
  ctx.write(
    'tsconfig.json',
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2023', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          strict: true,
          noUncheckedIndexedAccess: true,
          verbatimModuleSyntax: true,
          isolatedModules: true,
          skipLibCheck: true,
          noEmit: true,
          types: ['vite/client', '@kitr/vite/client'],
          baseUrl: '.',
          paths: {
            '#app/*': ['./app/*'],
            '#config/*': ['./config/*'],
            '#components/*': ['./app/components/*'],
          },
        },
        include: ['app', 'config', 'kitrrc.ts', 'vite.config.ts', 'test'],
      },
      null,
      2,
    )}\n`,
  )
  ctx.write(
    'vite.config.ts',
    `import { kitr } from 'kitr/vite'\nimport { defineConfig } from 'vite'\n\nexport default defineConfig({\n  plugins: [kitr()],\n})\n`,
  )
  ctx.write(
    'kitrrc.ts',
    `import { defineKitrConfig } from 'kitr/app'\n\n/**\n * Explicit wiring, the Adonis way: every provider is listed here as a lazy import.\n * \`kitr add\` and \`kitr remove\` edit this file; so can you.\n */\nexport default defineKitrConfig({\n  packages: ['@kitr/router', '@kitr/query'],\n  providers: [\n    () => import('@kitr/query/provider'),\n  ],\n  directories: {\n    app: 'app',\n    routes: 'app/routes',\n    config: 'config',\n    components: 'app/components',\n  },\n})\n`,
  )
  ctx.write(
    'biome.json',
    `{\n  "$schema": "https://biomejs.dev/schemas/2.6.6/schema.json",\n  "files": { "includes": ["**", "!**/routeTree.gen.ts", "!**/dist", "!**/.output"] },\n  "formatter": { "indentStyle": "space", "lineWidth": 100 },\n  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "asNeeded" } },\n  "css": { "parser": { "tailwindDirectives": true } },\n  "linter": { "rules": { "recommended": true } }\n}\n`,
  )
  ctx.write('.gitignore', 'node_modules\ndist\n.output\n.nitro\n.tanstack\n*.local\n.env\n')
  ctx.write(
    '.env.example',
    '# Copy to .env. Public variables start with VITE_ and ship to the browser.\n',
  )
  ctx.write(
    'index.html',
    `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${name}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/app/main.tsx"></script>\n  </body>\n</html>\n`,
  )
  ctx.write(
    'app/env.ts',
    `import { createEnv, env as e } from 'kitr/env'\n\n/** Validated at startup. Public vars (VITE_*) ship to the browser; server vars throw if read there. */\nexport const env = createEnv({\n  public: {\n    VITE_APP_NAME: e.string({ default: '${name}' }),\n  },\n  server: {},\n})\n`,
  )
  ctx.write(
    'app/app.ts',
    `import { createApp } from 'kitr/app'\nimport { config } from 'virtual:kitr/config'\nimport { providers } from 'virtual:kitr/providers'\nimport { env } from './env'\n\n/** One app object: providers from kitrrc.ts, config from config/*.ts, both as static imports. */\nexport const app = createApp({ providers, config, env })\n`,
  )
  ctx.write(
    'app/router.tsx',
    `import { createKitrRouter } from 'kitr/router'\nimport { app } from './app'\nimport { routeTree } from './routeTree.gen'\n\nexport function getRouter() {\n  return createKitrRouter({ routeTree, app })\n}\n\ndeclare module '@tanstack/react-router' {\n  interface Register {\n    router: ReturnType<typeof getRouter>\n  }\n}\n`,
  )
  ctx.write(
    'app/main.tsx',
    `import { RouterProvider } from 'kitr/router'\nimport { StrictMode } from 'react'\nimport { createRoot } from 'react-dom/client'\nimport { app } from './app'\nimport { getRouter } from './router'\n\nasync function main() {\n  await app.boot()\n  const router = getRouter()\n  createRoot(document.getElementById('root') as HTMLElement).render(\n    <StrictMode>\n      <RouterProvider router={router} />\n    </StrictMode>,\n  )\n}\n\nmain()\n`,
  )
  ctx.write(
    'app/routes/__root.tsx',
    `import type { KitrRouterContext } from 'kitr/router'\nimport { Link, Outlet, createRootRouteWithContext } from 'kitr/router'\nimport 'kitr/ui/styles.css'\n\nexport const Route = createRootRouteWithContext<KitrRouterContext>()({\n  component: RootLayout,\n})\n\nfunction RootLayout() {\n  return (\n    <>\n      <nav style={{ display: 'flex', gap: 12, padding: 12 }}>\n        <Link to="/">Home</Link>\n        <Link to="/about">About</Link>\n      </nav>\n      <Outlet />\n    </>\n  )\n}\n`,
  )
  ctx.write(
    'app/routes/index.tsx',
    `import { createFileRoute } from '@tanstack/react-router'\n\nexport const Route = createFileRoute('/')({\n  component: HomePage,\n})\n\nfunction HomePage() {\n  return (\n    <main style={{ padding: 24 }}>\n      <h1>${name}</h1>\n      <p>Edit <code>app/routes/index.tsx</code>. Add a page with <code>kitr make:route</code>.</p>\n    </main>\n  )\n}\n`,
  )
  ctx.write(
    'app/routes/about.tsx',
    `import { createFileRoute } from '@tanstack/react-router'\n\nexport const Route = createFileRoute('/about')({\n  component: () => <main style={{ padding: 24 }}>About</main>,\n})\n`,
  )
  ctx.write(
    'AGENTS.md',
    `# Agent guide\n\nThis app is built with kitr. Each section below is maintained by \`kitr add\`.\n\n## kitr: conventions\n\n- Import framework code from \`kitr/*\` entry points (\`kitr/router\`, \`kitr/query\`, ...). They re-export the upstream library unchanged plus kitr helpers.\n- Routes are files in \`app/routes\` (TanStack Router file routes). \`app/routeTree.gen.ts\` is generated; never edit it.\n- In route files, import \`createFileRoute\` / \`createLazyFileRoute\` from \`@tanstack/react-router\` (the route generator owns that import). Everything else comes from \`kitr/router\`.\n- Wiring lives in \`kitrrc.ts\` and \`config/*.ts\`. Generators: \`kitr make:route|action|controller|channel|store|form|queries\`. Run \`kitr doctor\` after changes.\n`,
  )
}

export const baseServer = (ctx: ProjectContext, name: string) => {
  ctx.write(
    'package.json',
    `${JSON.stringify(
      {
        name,
        private: true,
        type: 'module',
        scripts: {
          dev: 'tsx watch server.ts',
          start: 'node --import tsx server.ts',
          build: 'tsc --noEmit',
          typecheck: 'tsc --noEmit',
          test: 'vitest run',
          'api:sync': 'kitr api:sync',
          kitr: 'kitr',
        },
        dependencies: {
          kitr: `^${ctx.kitrVersion}`,
          '@kitr/core': `^${ctx.kitrVersion}`,
        },
        devDependencies: {
          '@biomejs/biome': versionOf('@biomejs/biome'),
          '@types/node': versionOf('@types/node'),
          tsx: versionOf('tsx'),
          typescript: versionOf('typescript'),
          vitest: versionOf('vitest'),
        },
      },
      null,
      2,
    )}\n`,
  )
  ctx.write(
    'tsconfig.json',
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2023'],
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          noUncheckedIndexedAccess: true,
          verbatimModuleSyntax: true,
          isolatedModules: true,
          skipLibCheck: true,
          noEmit: true,
          types: ['node'],
          baseUrl: '.',
          paths: {
            '#app/*': ['./app/*'],
            '#config/*': ['./config/*'],
            '#controllers/*': ['./app/controllers/*'],
            '#start/*': ['./start/*'],
          },
        },
        include: ['app', 'config', 'start', 'kitrrc.ts', 'server.ts', 'test'],
      },
      null,
      2,
    )}\n`,
  )
  ctx.write(
    'kitrrc.ts',
    `import { defineKitrConfig } from 'kitr/app'\n\n/** Server-only kitr app: no React anywhere in the dependency graph. */\nexport default defineKitrConfig({\n  packages: [],\n  providers: [],\n  directories: { app: 'app', config: 'config' },\n})\n`,
  )
  ctx.write(
    'biome.json',
    `{\n  "$schema": "https://biomejs.dev/schemas/2.6.6/schema.json",\n  "formatter": { "indentStyle": "space", "lineWidth": 100 },\n  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "asNeeded" } },\n  "css": { "parser": { "tailwindDirectives": true } },\n  "linter": { "rules": { "recommended": true } }\n}\n`,
  )
  ctx.write('.gitignore', 'node_modules\ndist\n*.local\n.env\n')
  ctx.write('.env.example', '# Copy to .env\n')
  ctx.write(
    'app/env.ts',
    `import { createEnv, env as e } from 'kitr/env'\n\nexport const env = createEnv({\n  server: {\n    PORT: e.number({ default: 3000 }),\n    LOG_LEVEL: e.enum(['debug', 'info', 'warn', 'error'], { default: 'info' }),\n  },\n})\n`,
  )
  ctx.write(
    'AGENTS.md',
    `# Agent guide\n\nThis is a server-only kitr app (no React). Each section below is maintained by \`kitr add\`.\n\n## kitr: conventions\n\n- Routes in \`start/routes.ts\`, controllers in \`app/controllers/*_controller.ts\`, config in \`config/*.ts\`, wiring in \`kitrrc.ts\`.\n- Start with \`${ctx.pm} dev\`; the server is \`server.ts\`. Run \`kitr doctor\` after changes.\n`,
  )
  // package.json paths for subpath imports at runtime (tsx honours tsconfig paths? no: use package.json "imports")
  const pkg = JSON.parse(ctx.read('package.json'))
  pkg.imports = {
    '#app/*': './app/*',
    '#config/*': './config/*',
    '#controllers/*': './app/controllers/*',
    '#start/*': './start/*',
  }
  ctx.write('package.json', `${JSON.stringify(pkg, null, 2)}\n`, { overwrite: true })
}
