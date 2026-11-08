import type { ProjectContext } from './context'
import { versionOf } from './versions'

/**
 * The blank base every project starts from: the wiring files and nothing else. No app/, no
 * Vite, no React, no server: `kitr add <platform>` and `kitr add <package>` bring each of those,
 * and the files they own, through their own setup modules. Biome is the one opinion kept here,
 * because every TypeScript project lints.
 */
export const base = (ctx: ProjectContext, name: string) => {
  ctx.write(
    'package.json',
    `${JSON.stringify(
      {
        name,
        private: true,
        type: 'module',
        scripts: {
          typecheck: 'kitr types && tsc --noEmit',
          lint: 'biome check .',
          kitr: 'kitr',
        },
        dependencies: {
          kitr: `^${ctx.kitrVersion}`,
          '@kitr/core': `^${ctx.kitrVersion}`,
        },
        devDependencies: {
          '@biomejs/biome': versionOf('@biomejs/biome'),
          '@types/node': versionOf('@types/node'),
          typescript: versionOf('typescript'),
        },
        // Subpath imports for the directories kitr owns, so `#server/*` resolves at run time too.
        imports: {
          '#app/*': './app/*',
          '#config/*': './config/*',
          '#components/*': './app/components/*',
          '#server/*': './server/*',
          '#kitr/*': './.kitr/*',
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
            '#components/*': ['./app/components/*'],
            '#server/*': ['./server/*'],
            '#kitr/*': ['./.kitr/*'],
          },
        },
        include: ['app', 'config', 'server', 'platforms', '.kitr/**/*', 'kitrrc.ts', 'test'],
        exclude: ['platforms/**/src-tauri', 'platforms/**/ios', 'platforms/**/android'],
      },
      null,
      2,
    )}\n`,
  )
  ctx.write(
    'kitrrc.ts',
    `import { defineKitrConfig } from 'kitr/app'\n\n/**\n * Explicit wiring, the Adonis way: every provider is listed here as a lazy import and every\n * platform by name. \`kitr add\`, \`kitr remove\` and \`kitr config\` edit this file; so can you.\n */\nexport default defineKitrConfig({\n  packages: [],\n  providers: [],\n  platforms: {},\n  directories: {\n    app: 'app',\n    routes: 'app/routes',\n    config: 'config',\n    components: 'app/components',\n    server: 'server',\n    platforms: 'platforms',\n  },\n})\n`,
  )
  ctx.write(
    'biome.json',
    `{\n  "$schema": "https://biomejs.dev/schemas/2.6.6/schema.json",\n  "files": { "includes": ["**", "!**/routeTree.gen.ts", "!**/.kitr", "!**/dist", "!**/.output"] },\n  "formatter": { "indentStyle": "space", "lineWidth": 100 },\n  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "asNeeded" } },\n  "css": { "parser": { "tailwindDirectives": true } },\n  "linter": { "rules": { "recommended": true } }\n}\n`,
  )
  ctx.write('.gitignore', 'node_modules\ndist\n.output\n.nitro\n.tanstack\n.kitr\n*.local\n.env\n')
  ctx.write('.env.example', '# Copy to .env. Each package adds the variables it reads below.\n')
  ctx.write(
    'AGENTS.md',
    `# Agent guide\n\nThis app is built with kitr. Each section below is maintained by \`kitr add\`.\n\n## kitr: conventions\n\n- Import framework code from the \`@kitr/*\` package that \`kitr add\` installed (\`@kitr/router\`, \`@kitr/query\`, ...). Each re-exports the upstream library unchanged plus kitr helpers. \`kitr\` itself is the CLI and the \`kitrrc.ts\` config (\`kitr/app\`, \`kitr/env\`).\n- Where the app runs is a platform in \`kitrrc.ts\` (\`platforms: { site: web({...}), api: server({...}) }\`). \`kitr dev <name>\` / \`kitr build <name>\` / \`kitr start <name>\` run one or all; \`kitr config <name> <option> <value>\` edits options; native projects live in \`platforms/<name>/\`.\n- Wiring lives in \`kitrrc.ts\` and \`config/*.ts\`. Generated types live in \`.kitr/\` (\`kitr types\`, also run by \`kitr dev\` and \`kitr build\`); import them from \`#kitr/*\`. Run \`kitr doctor\` after changes.\n\n## kitr: structure\n\n- Every kind of file has one home. \`kitr make\` lists them with the path each \`kitr make:<kind> <name>\` writes; create files with those commands instead of by hand.\n- \`app/\` is what Vite bundles: pages, layouts, components, hooks, stores, queries, actions, validators, exceptions, providers, channels. \`server/\` is the standalone server and never imports React: controllers, services, middleware, jobs, mail. A declaration both sides read lives in \`app/\`.\n- File names are kebab-case. The file carries a kind suffix exactly when its export does (\`UsersController\` in \`users-controller.ts\`, \`BillingService\` in \`billing-service.ts\`); \`define*()\` files have none (\`server/jobs/send-receipt.ts\`). Pages are named by their URL path.\n- Group by feature inside the kind folder: \`kitr make:controller admin/users\` writes \`server/controllers/admin/users-controller.ts\`.\n- Import across folders with \`#app/*\`, \`#components/*\`, \`#server/*\`, \`#config/*\`, \`#kitr/*\`; relative imports only inside one folder.\n`,
  )
}

/**
 * README.md for a new project. Written once, after the kit has run, so it lists the scripts and
 * folders that actually exist.
 */
export const writeReadme = (ctx: ProjectContext, name: string, kit: string) => {
  const scripts = (ctx.pkg.scripts ?? {}) as Record<string, string>
  const run = (s: string) => (ctx.pm === 'npm' ? `npm run ${s}` : `${ctx.pm} run ${s}`)
  const notes: Record<string, string> = {
    dev: 'start the dev server',
    build: 'build for production',
    start: 'run the production build',
    test: 'run the tests',
    typecheck: 'check the types',
  }
  const commands = Object.keys(notes)
    .filter((s) => scripts[s])
    .map((s) => `${run(s).padEnd(22)}# ${notes[s]}`)
  const places = [
    ['kitrrc.ts', 'the wiring: packages, providers and platforms'],
    ['config/', 'one file per package'],
    ['app/routes.ts', 'the page list'],
    ['app/pages/', 'page components'],
    ['app/features/', 'feature code'],
    ['server/', 'server code'],
    ['AGENTS.md', 'conventions for coding assistants'],
  ]
    .filter(([p]) => ['kitrrc.ts', 'AGENTS.md'].includes(p as string) || ctx.exists(p as string))
    .map(([p, d]) => `- \`${p}\`: ${d}`)
  const block = `\`\`\`sh\n${commands.join('\n')}\n\`\`\``
  const intro = scripts.dev
    ? block
    : `No dev server yet. Run \`kitr add web site\` to add one.${commands.length ? `\n\n${block}` : ''}`
  ctx.write(
    'README.md',
    `# ${name}

Built with [kitr](https://kitr.dev) from the \`${kit}\` kit.

## Run it

${intro}

## Where things live

${places.join('\n')}

## Add things

- \`kitr add <package>\`: add sign-in, forms, an API and more
- \`kitr make:page <path>\`: add a page
- \`kitr ui add <component>\`: add a UI component

Run \`kitr --help\` for every command.

Docs: https://kitr.dev/docs/getting-started
Packages: https://kitr.dev/packages
`,
  )
}
