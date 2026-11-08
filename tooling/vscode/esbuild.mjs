// Bundles src/extension.ts into one CommonJS file for VS Code. `vscode` stays external: the
// editor provides it at run time.
//
//   node esbuild.mjs                 development build with source maps
//   node esbuild.mjs --production    minified, no source maps (what `vsce package` runs)
//   node esbuild.mjs --watch         rebuild on change
import { context } from 'esbuild'

const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

const ctx = await context({
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  external: ['vscode'],
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  logLevel: 'info',
})

if (watch) await ctx.watch()
else {
  await ctx.rebuild()
  await ctx.dispose()
}
