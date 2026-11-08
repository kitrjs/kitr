// Production bundle checks for every published package. Run after `pnpm build`.
//
//   node scripts/check-bundles.mjs
//
// 1. every `exports` target exists in dist
// 2. publint finds no errors
// 3. every entry imports in plain Node without throwing (SSR safety: no window/document at import)
// 4. every @kitr/* or third-party package a dist file imports is a declared dependency
// 5. server entries never pull React into their import graph
// 6. browser entries never import node: builtins
// 7. size budgets (gzip) per entry, so an accidental bundle-in shows up
// 8. the umbrella depends on core and the CLI only; every other subpath is an optional peer
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = fileURLToPath(new URL('..', import.meta.url))
const packagesDir = join(root, 'packages')
const failures = []
const fail = (pkg, msg) => failures.push(`${pkg}: ${msg}`)

/** Entries that run on the server and must stay free of React. */
const serverEntries = new Set([
  '@kitr/core',
  '@kitr/logger',
  '@kitr/server',
  '@kitr/api',
  '@kitr/db',
  '@kitr/realtime/server',
  '@kitr/realtime/socket.io/server',
  '@kitr/realtime/sse/server',
  '@kitr/seo',
  '@kitr/theme/server',
  '@kitr/web',
  '@kitr/desktop',
  '@kitr/tauri',
  '@kitr/mobile',
  '@kitr/server/platform',
  '@kitr/auth/server',
  '@kitr/storage/server',
  '@kitr/testing',
  '@kitr/cli',
])
/** Entries that run in the browser and must not import Node builtins. */
const browserEntries = new Set([
  '@kitr/core',
  '@kitr/react',
  '@kitr/query',
  '@kitr/query/provider',
  '@kitr/router',
  '@kitr/router/stack',
  '@kitr/forms',
  '@kitr/theme',
  '@kitr/state',
  '@kitr/storage',
  '@kitr/storage/react',
  '@kitr/http',
  '@kitr/realtime',
  '@kitr/realtime/socket.io',
  '@kitr/realtime/sse',
  '@kitr/realtime/react',
  '@kitr/auth',
  '@kitr/i18n',
  '@kitr/table',
  '@kitr/animation',
  '@kitr/animation/provider',
  '@kitr/3d',
  '@kitr/3d/drei',
  '@kitr/devtools',
  '@kitr/analytics',
  '@kitr/monitoring',
  '@kitr/web/client',
  '@kitr/desktop/client',
  '@kitr/tauri/client',
  '@kitr/mobile/client',
  '@kitr/platform',
  '@kitr/platform/react',
  '@kitr/seo',
  '@kitr/actions',
  '@kitr/uploads',
  '@kitr/uploads/react',
  '@kitr/flags',
  '@kitr/flags/react',
  '@kitr/consent',
  '@kitr/consent/react',
  '@kitr/offline',
  '@kitr/offline/react',
  '@kitr/secure-storage',
  '@kitr/secure-storage/react',
  '@kitr/files',
  '@kitr/files/react',
  '@kitr/notifications',
  '@kitr/notifications/react',
  '@kitr/native',
  '@kitr/native/react',
  '@kitr/updater',
  '@kitr/updater/react',
])
/** Entries that legitimately need a host at import time (a DOM, Electron, Vite). */
const skipNodeImport = new Set(['@kitr/desktop/main', '@kitr/desktop/preload', '@kitr/kitr'])
/** Gzip budget per entry file, bytes. Generous; the point is catching a dependency bundled in. */
/** Does this entry hold code templates (import lines inside strings), so import scans would misread it? */
const isCodegen = (name, spec) =>
  codegen.has(name) || codegenEntries.has(spec) || spec === `${name}/kitr`
/** Subpath entries that hold templates while the rest of their package is plain code. */
const codegenEntries = new Set([
  // startRoot(): the generated app/routes/__root.tsx the kits share.
  '@kitr/core/package',
])
/** Packages whose dist contains code templates: skip import scans. A package's `./kitr` setup module always is. */
const codegen = new Set([
  '@kitr/cli',
  '@kitr/vite',
  '@kitr/web',
  '@kitr/desktop',
  '@kitr/tauri',
  '@kitr/mobile',
  '@kitr/server',
  'kitr',
])
const defaultBudget = 12 * 1024
const budgets = {
  // The CLI is all its own source: commands, recipes, kits, stubs and the types runner.
  '@kitr/cli': 96 * 1024,
  '@kitr/vite': 30 * 1024,
  '@kitr/devtools': 20 * 1024,
  '@kitr/desktop': 20 * 1024,
  '@kitr/tauri': 20 * 1024,
  '@kitr/web': 16 * 1024,
  // Kit packages are nothing but file templates.
  '@kitr/kit-saas': 40 * 1024,
  '@kitr/kit-site': 40 * 1024,
  '@kitr/kit-realtime': 32 * 1024,
  '@kitr/kit-desktop': 16 * 1024,
  '@kitr/kit-tauri': 16 * 1024,
  '@kitr/kit-mobile': 16 * 1024,
}

const builtins = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]))
const importRe =
  /(?:^|[\s;}])(?:import|export)\s*(?:[^'"`;]*?\sfrom\s*)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm

function specifiers(file) {
  // Doc comments quote import lines in their examples; only code counts.
  const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  return [...src.matchAll(importRe)].map((m) => m[1] ?? m[2])
}
const packageName = (spec) =>
  spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]

/** Static + dynamic import graph inside one package's dist, starting at `entry`. */
function graph(entry) {
  const seen = new Set()
  const external = new Set()
  const walk = (file) => {
    if (seen.has(file) || !existsSync(file)) return
    seen.add(file)
    for (const spec of specifiers(file)) {
      if (spec.startsWith('.')) walk(resolve(dirname(file), spec))
      else external.add(spec)
    }
  }
  walk(entry)
  return { files: seen, external }
}

/** Externals reachable from an entry, following @kitr/* workspace packages too. */
function deepExternals(entry, visited = new Set()) {
  const out = new Set()
  if (visited.has(entry)) return out
  visited.add(entry)
  for (const spec of graph(entry).external) {
    out.add(spec)
    if (spec.startsWith('@kitr/')) {
      const target = resolveWorkspace(spec)
      if (target) for (const s of deepExternals(target, visited)) out.add(s)
    }
  }
  return out
}

const manifests = new Map()
for (const dir of readdirSync(packagesDir)) {
  const pkgPath = join(packagesDir, dir, 'package.json')
  if (!existsSync(pkgPath)) continue
  manifests.set(dir, JSON.parse(readFileSync(pkgPath, 'utf8')))
}
function resolveWorkspace(spec) {
  const name = packageName(spec)
  const sub = spec.slice(name.length) || ''
  for (const [dir, pkg] of manifests) {
    if (pkg.name !== name) continue
    const target = pkg.exports?.[`.${sub}`]
    const file = typeof target === 'string' ? target : target?.default
    return file ? join(packagesDir, dir, file) : undefined
  }
}

for (const [dir, pkg] of manifests) {
  const pkgDir = join(packagesDir, dir)
  const name = pkg.name
  const declared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
    name,
  ])

  // 1. exports targets exist
  const entries = []
  for (const [sub, target] of Object.entries(pkg.exports ?? {})) {
    if (sub === './package.json') continue
    const conds = typeof target === 'string' ? { default: target } : target
    for (const [cond, file] of Object.entries(conds)) {
      if (typeof file !== 'string') continue
      if (file.includes('*')) continue
      if (!existsSync(join(pkgDir, file)))
        fail(name, `exports["${sub}"].${cond} → ${file} is missing`)
    }
    if (conds.default && /\.m?js$/.test(conds.default) && existsSync(join(pkgDir, conds.default)))
      entries.push({ spec: `${name}${sub.slice(1)}`, file: join(pkgDir, conds.default) })
  }

  // 2. publint
  try {
    const out = execFileSync(join(root, 'node_modules/.bin/publint'), ['--level', 'error'], {
      cwd: pkgDir,
      encoding: 'utf8',
      stdio: 'pipe',
    })
    if (/Errors:/i.test(out)) fail(name, `publint:\n${out}`)
  } catch (error) {
    fail(name, `publint:\n${error.stdout ?? ''}${error.stderr ?? ''}`)
  }

  for (const { spec, file } of entries) {
    // 4. undeclared imports
    for (const ext of isCodegen(name, spec) ? [] : graph(file).external) {
      if (builtins.has(ext) || ext.startsWith('virtual:')) continue
      const dep = packageName(ext)
      if (!declared.has(dep)) fail(spec, `imports "${ext}" but ${dep} is not a dependency`)
    }

    const reach = isCodegen(name, spec) ? new Set() : deepExternals(file)
    // 5. server entries stay React-free
    if (serverEntries.has(spec)) {
      const react = [...reach].filter((s) => /^(react|react-dom)(\/|$)/.test(s))
      if (react.length) fail(spec, `server entry reaches ${react.join(', ')}`)
    }
    // 6. browser entries stay free of Node builtins (dynamic imports included)
    if (browserEntries.has(spec)) {
      const node = [...reach].filter((s) => builtins.has(s))
      if (node.length) fail(spec, `browser entry imports ${node.join(', ')}`)
    }

    // 7. size budget (entry chunk + its static relative imports)
    const { files } = graph(file)
    let size = 0
    for (const f of files) size += gzipSync(readFileSync(f)).length
    const budget = budgets[spec] ?? budgets[name] ?? defaultBudget
    if (size > budget)
      fail(
        spec,
        `${(size / 1024).toFixed(1)} kB gzip over the ${(budget / 1024).toFixed(0)} kB budget`,
      )
  }
}

// 8. a blank project installs only the core and the CLI: every other `kitr/*` subpath is an
//    optional peer that `kitr add <package>` brings in. A hard dependency here would ship to
//    every project whether it uses the package or not.
{
  const umbrella = manifests.get('kitr')
  const hard = Object.keys(umbrella.dependencies ?? {}).sort()
  const allowed = ['@kitr/cli', '@kitr/core']
  if (hard.join() !== allowed.join())
    fail(
      'kitr',
      `dependencies must be exactly ${allowed.join(', ')} (got ${hard.join(', ')}); make the rest optional peers`,
    )
  for (const [dir, pkg] of manifests) {
    if (dir === 'kitr' || dir === 'core' || dir === 'cli') continue
    if (!umbrella.peerDependencies?.[pkg.name]) continue
    if (!umbrella.peerDependenciesMeta?.[pkg.name]?.optional)
      fail('kitr', `peer ${pkg.name} must be optional`)
  }
}

// 3. every entry imports in Node (run in one child process so module state is isolated from us)
const importable = []
for (const [dir, pkg] of manifests)
  for (const [sub, target] of Object.entries(pkg.exports ?? {})) {
    const spec = `${pkg.name}${sub.slice(1)}`
    const file = typeof target === 'string' ? target : target?.default
    if (sub === './package.json' || skipNodeImport.has(spec) || !file?.endsWith('.js')) continue
    if (dir === 'kitr') continue
    importable.push([spec, pathToFileURL(join(packagesDir, dir, file)).href])
  }
const script = `
const results = []
for (const [spec, url] of ${JSON.stringify(importable)}) {
  try { await import(url) } catch (e) { results.push(spec + ': ' + (e && e.message ? e.message.split('\\n')[0] : e)) }
}
console.log(JSON.stringify(results))
`
try {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  for (const line of JSON.parse(out.trim().split('\n').pop())) failures.push(`node import: ${line}`)
} catch (error) {
  failures.push(`node import crashed:\n${error.stdout ?? ''}${error.stderr ?? ''}`)
}

const checked = [...manifests.values()].length
if (failures.length) {
  console.error(
    `Bundle checks failed (${failures.length}):\n${failures.map((f) => `  - ${f}`).join('\n')}`,
  )
  process.exit(1)
}
console.log(`Bundle checks passed for ${checked} packages.`)
