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
          dev: 'kitr dev',
          build: 'kitr build',
          start: 'kitr start',
          typecheck: 'tsc --noEmit',
          test: 'vitest run',
          lint: 'biome check .',
          kitr: 'kitr',
        },
        dependencies: {
          kitr: `^${ctx.kitrVersion}`,
          '@kitr/core': `^${ctx.kitrVersion}`,
        },
        devDependencies: {
          '@kitr/vite': `^${ctx.kitrVersion}`,
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
            '#server/*': ['./server/*'],
          },
        },
        include: ['app', 'config', 'server', 'platforms', 'kitrrc.ts', 'vite.config.ts', 'test'],
        exclude: ['platforms/**/src-tauri', 'platforms/**/ios', 'platforms/**/android'],
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
    `import { defineKitrConfig } from 'kitr/app'\n\n/**\n * Explicit wiring, the Adonis way: every provider is listed here as a lazy import and every\n * platform by name. \`kitr add\`, \`kitr remove\` and \`kitr config\` edit this file; so can you.\n */\nexport default defineKitrConfig({\n  packages: [],\n  providers: [],\n  platforms: {},\n  directories: {\n    app: 'app',\n    routes: 'app/routes',\n    config: 'config',\n    components: 'app/components',\n    server: 'server',\n    platforms: 'platforms',\n  },\n})\n`,
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
    'AGENTS.md',
    `# Agent guide\n\nThis app is built with kitr. Each section below is maintained by \`kitr add\`.\n\n## kitr: conventions\n\n- Import framework code from \`kitr/*\` entry points (\`kitr/router\`, \`kitr/query\`, ...). They re-export the upstream library unchanged plus kitr helpers.\n- Where the app runs is a platform in \`kitrrc.ts\` (\`platforms: { site: web({...}), api: server({...}) }\`). \`kitr dev <name>\` / \`kitr build <name>\` / \`kitr start <name>\` run one or all; \`kitr config <name> <option> <value>\` edits options; native projects live in \`platforms/<name>/\`.\n- Wiring lives in \`kitrrc.ts\` and \`config/*.ts\`; server code in \`server/\`. Generators: \`kitr make:route|action|controller|channel|store|form|queries\`. Run \`kitr doctor\` after changes.\n`,
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
          dev: 'kitr dev',
          build: 'kitr build',
          start: 'kitr start',
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
            '#server/*': ['./server/*'],
          },
        },
        include: ['app', 'config', 'server', 'platforms', 'kitrrc.ts', 'test'],
      },
      null,
      2,
    )}\n`,
  )
  ctx.write(
    'kitrrc.ts',
    `import { defineKitrConfig } from 'kitr/app'\n\n/** Server-only kitr app: no React anywhere in the dependency graph. */\nexport default defineKitrConfig({\n  packages: [],\n  providers: [],\n  platforms: {},\n  directories: { app: 'app', config: 'config', server: 'server', platforms: 'platforms' },\n})\n`,
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
    `# Agent guide\n\nThis is a server-only kitr app (no React). Each section below is maintained by \`kitr add\`.\n\n## kitr: conventions\n\n- Routes in \`server/routes.ts\`, controllers in \`server/controllers/*_controller.ts\`, config in \`config/*.ts\`, wiring in \`kitrrc.ts\` (the \`server\` platform under \`platforms\`).\n- Start with \`kitr dev\`; the entry is \`server/main.ts\`. Run \`kitr doctor\` after changes.\n`,
  )
  // package.json paths for subpath imports at runtime (tsx honours tsconfig paths? no: use package.json "imports")
  const pkg = JSON.parse(ctx.read('package.json'))
  pkg.imports = {
    '#app/*': './app/*',
    '#config/*': './config/*',
    '#server/*': './server/*',
  }
  ctx.write('package.json', `${JSON.stringify(pkg, null, 2)}\n`, { overwrite: true })
}
