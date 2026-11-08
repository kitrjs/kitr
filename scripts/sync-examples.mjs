// Regenerates examples/* from the CLI kits, so each example stays the unmodified output of
// `kitr new`. The only edits: kitr/@kitr/* point at the workspace, the package is renamed
// @kitr/example-<name>, and the per-project biome.json is dropped (the root config applies).
//
//   node scripts/sync-examples.mjs           rewrite the examples
//   node scripts/sync-examples.mjs --check   exit 1 and list files when an example has drifted
//
// Needs built packages (`pnpm build`): the CLI runs from packages/kitr.
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
export const examples = {
  blank: 'blank',
  backend: 'server',
  dashboard: 'app',
  fullstack: 'fullstack',
  saas: 'saas',
  site: 'site',
  realtime: 'realtime',
  desktop: 'desktop',
  tauri: 'tauri',
  mobile: 'mobile',
  everywhere: 'app',
}
/**
 * Examples that are a kit plus more `kitr add` commands (run in order, after `kitr new`) and
 * optionally files copied over the result from `overlay` (a folder under scripts/).
 * Platforms first, so the device packages see Capacitor and add its plugins.
 */
const extras = {
  everywhere: {
    steps: [
      ['add', 'desktop', 'app', '--no-install'],
      ['add', 'mobile', 'phone', '--no-install'],
      ['add', 'secure-storage', '--no-install', '--yes'],
      ['add', 'notifications', '--no-install', '--yes'],
      // Level one of docs/extending: your own provider. The overlay fills in the stub.
      ['make:provider', 'flags'],
    ],
    overlay: 'scripts/overlays/everywhere',
  },
}
/** Build output and generated files that are not part of the kit. */
const ignored = new Set([
  'node_modules',
  'dist',
  '.output',
  '.tanstack',
  '.nitro',
  '.kitr',
  'routeTree.gen.ts',
  // Written by `kitr generate` (api:sync) from the example's real routes on every dev, build and typecheck.
  'routes.gen.ts',
  'openapi.json',
])

function walk(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (ignored.has(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, base, out)
    else out.push(relative(base, path))
  }
  return out.sort()
}

function normalise(dir, name) {
  rmSync(join(dir, 'biome.json'), { force: true })
  const pkgPath = join(dir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  pkg.name = `@kitr/example-${name}`
  for (const field of ['dependencies', 'devDependencies']) {
    for (const dep of Object.keys(pkg[field] ?? {}))
      if (dep === 'kitr' || dep.startsWith('@kitr/')) pkg[field][dep] = 'workspace:*'
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}

/** Generate every example into a temp dir; returns { name: dir }. */
export function generate() {
  const tmp = mkdtempSync(join(tmpdir(), 'kitr-examples-'))
  const out = {}
  for (const [name, kit] of Object.entries(examples)) {
    execFileSync(
      process.execPath,
      [
        join(root, 'packages/kitr/bin/kitr.mjs'),
        'new',
        name,
        '--kit',
        kit,
        '--no-install',
        '--no-git',
        '--registry',
        join(root, 'registry/dist'),
      ],
      {
        cwd: tmp,
        stdio: 'pipe',
        env: { ...process.env, CI: '1', NO_COLOR: '1', KITR_PREVIEW: '1' },
      },
    )
    const env = { ...process.env, CI: '1', NO_COLOR: '1', KITR_PREVIEW: '1' }
    for (const step of extras[name]?.steps ?? [])
      execFileSync(process.execPath, [join(root, 'packages/kitr/bin/kitr.mjs'), ...step], {
        cwd: join(tmp, name),
        stdio: 'pipe',
        env,
      })
    if (extras[name]?.overlay)
      cpSync(join(root, extras[name].overlay), join(tmp, name), { recursive: true })
    normalise(join(tmp, name), name)
    out[name] = join(tmp, name)
  }
  return { tmp, dirs: out }
}

/** Files that differ between a generated example and the committed one. */
export function drift(generatedDir, exampleDir) {
  const a = walk(generatedDir)
  const b = walk(exampleDir)
  const problems = []
  for (const f of a) {
    if (!b.includes(f)) problems.push(`missing: ${f}`)
    else if (!readFileSync(join(generatedDir, f)).equals(readFileSync(join(exampleDir, f))))
      problems.push(`differs: ${f}`)
  }
  for (const f of b) if (!a.includes(f)) problems.push(`extra:   ${f}`)
  return problems
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check')
  const { tmp, dirs } = generate()
  let failed = false
  try {
    for (const [name, dir] of Object.entries(dirs)) {
      const target = join(root, 'examples', name)
      const problems = drift(dir, target)
      if (!problems.length) continue
      if (check) {
        failed = true
        console.error(`examples/${name} has drifted from \`kitr new --kit ${examples[name]}\`:`)
        for (const p of problems) console.error(`  ${p}`)
        continue
      }
      for (const f of walk(target)) rmSync(join(target, f))
      mkdirSync(target, { recursive: true })
      cpSync(dir, target, { recursive: true })
      console.log(`examples/${name}: ${problems.length} file(s) updated`)
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  if (failed) {
    console.error('\nRun `node scripts/sync-examples.mjs` to regenerate.')
    process.exit(1)
  }
}
