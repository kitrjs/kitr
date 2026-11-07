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
    `# Agent guide\n\nThis app is built with kitr. Each section below is maintained by \`kitr add\`.\n\n## kitr: conventions\n\n- Import framework code from \`kitr/*\` entry points (\`kitr/router\`, \`kitr/query\`, ...). They re-export the upstream library unchanged plus kitr helpers.\n- Where the app runs is a platform in \`kitrrc.ts\` (\`platforms: { site: web({...}), api: server({...}) }\`). \`kitr dev <name>\` / \`kitr build <name>\` / \`kitr start <name>\` run one or all; \`kitr config <name> <option> <value>\` edits options; native projects live in \`platforms/<name>/\`.\n- Wiring lives in \`kitrrc.ts\` and \`config/*.ts\`; server code in \`server/\`. Every package brings its own generators (\`kitr make:<kind>\`, see \`kitr --help\`). Generated types live in \`.kitr/\` (\`kitr types\`, also run by \`kitr dev\` and \`kitr build\`); import them from \`#kitr/*\`. Run \`kitr doctor\` after changes.\n`,
  )
}
