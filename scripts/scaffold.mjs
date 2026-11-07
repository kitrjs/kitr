// Usage: node scripts/scaffold.mjs <name> '<json spec>'
// Writes package.json, tsconfig.json and tsdown.config.ts for a package.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [name, specJson] = process.argv.slice(2)
const spec = JSON.parse(specJson)
const dir = join('packages', name)
mkdirSync(join(dir, 'src'), { recursive: true })

const entries = spec.entries ?? { '.': 'src/index.ts' }
const exportsMap = {}
const entryList = []
for (const [sub, file] of Object.entries(entries)) {
  const base = file.replace(/^src\//, '').replace(/\.tsx?$/, '')
  exportsMap[sub] = { types: `./dist/${base}.d.ts`, default: `./dist/${base}.js` }
  entryList.push(file)
}
exportsMap['./package.json'] = './package.json'

const pkg = {
  name: spec.fullName ?? `@kitr/${name}`,
  version: '0.1.0',
  description: spec.description ?? '',
  type: 'module',
  license: 'MIT',
  sideEffects: false,
  ...(spec.bin ? { bin: spec.bin } : {}),
  exports: exportsMap,
  files: ['dist', ...(spec.files ?? [])],
  scripts: { build: 'tsdown', typecheck: 'tsc -p tsconfig.json', ...(spec.scripts ?? {}) },
  dependencies: spec.dependencies ?? {},
  peerDependencies: spec.peerDependencies ?? {},
  peerDependenciesMeta: Object.fromEntries(
    Object.keys(spec.optionalPeers ?? {}).map((k) => [k, { optional: true }]),
  ),
  devDependencies: { tsdown: '^0.23.7', typescript: '^5.9.3', ...(spec.devDependencies ?? {}) },
}
Object.assign(pkg.peerDependencies, spec.optionalPeers ?? {})
if (Object.keys(pkg.peerDependenciesMeta).length === 0) delete pkg.peerDependenciesMeta
writeFileSync(join(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
writeFileSync(
  join(dir, 'tsconfig.json'),
  `${JSON.stringify(
    {
      extends: '../../tsconfig.base.json',
      compilerOptions: { rootDir: 'src', ...(spec.tsconfig ?? {}) },
      include: ['src'],
    },
    null,
    2,
  )}\n`,
)
writeFileSync(
  join(dir, 'tsdown.config.ts'),
  `import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ${JSON.stringify(entryList)},
  format: ['esm'],
  dts: true,
  clean: true,
  platform: '${spec.platform ?? 'neutral'}',
  fixedExtension: false,${spec.external ? `\n  external: ${JSON.stringify(spec.external)},` : ''}
})
`,
)
console.log('scaffolded', pkg.name)
