// Registry smoke test: publish every public workspace package to a throwaway Verdaccio under a
// prerelease version, then use the published CLI the way a user would.
//
//   pnpm build && pnpm -C registry build && pnpm smoke:registry
//   node scripts/verdaccio-smoke.mjs --kits app,fullstack --keep
//
// What it proves, in order:
//   1. every public package packs and publishes (workspace: ranges become real versions)
//   2. every peer of the umbrella `kitr` package, every dependency of every package, every
//      upstream version pinned in the CLI's versions.ts and every `builtOn` library resolves
//      from the registry
//   3. `kitr` installs from the registry, and `kitr new --kit <kit>` installs, typechecks and
//      builds from it, which loads every `kitr.ts` setup module the kit uses
//   4. with `--all-packages`: `kitr add` of every released package, one at a time, in one project
//
// The real versions and the changesets are never touched: package.json files are bumped for the
// pack and restored in a finally block. Needs network access to registry.npmjs.org for the
// upstream packages. Verdaccio runs through `npx`, so nothing is added to the repo's dependencies.
//
// Options: --kits a,b   --port 4873   --keep (keep the scratch dir)   --all-packages
//          --skip-projects (publish and resolve checks only)
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import semver from 'semver'

const VERDACCIO = 'verdaccio@6.11.1' // 7.x needs Node 24; the repo supports 22
const root = fileURLToPath(new URL('..', import.meta.url))
const win = process.platform === 'win32'

const { values: opts } = parseArgs({
  options: {
    kits: { type: 'string', default: 'app,fullstack' },
    port: { type: 'string', default: '4873' },
    keep: { type: 'boolean', default: false },
    'all-packages': { type: 'boolean', default: false },
    'skip-projects': { type: 'boolean', default: false },
  },
})
const port = Number(opts.port)
const registryUrl = `http://127.0.0.1:${port}/`

const log = (msg) => console.log(`\n==> ${msg}`)
const failures = []
const notes = []
/** The last lines of a failed command's output, for the summary. */
const tail = (error, n = 8) =>
  `${error.message}: ${`${error.stdout ?? ''}\n${error.stderr ?? ''}`
    .trim()
    .split('\n')
    .filter((l) => l.trim())
    .slice(-n)
    .join(' | ')}`

/**
 * Run a command and echo its output once it ends (CI logs keep it). Throws on a non-zero exit,
 * with the output attached so the failure summary can say why.
 */
function sh(cmd, args, options = {}) {
  const { capture, env, ...rest } = options
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    shell: win && cmd !== process.execPath, // npm and pnpm are .cmd shims on Windows
    env: Object.fromEntries(
      Object.entries({ ...process.env, ...env }).filter(([, v]) => v !== undefined),
    ),
    ...rest,
  })
  if (!capture) {
    process.stdout.write(res.stdout ?? '')
    process.stdout.write(res.stderr ?? '')
  }
  if (res.error || res.status !== 0) {
    const error = new Error(`${cmd} ${args.join(' ')} exited with ${res.status ?? res.error}`)
    error.stdout = res.stdout
    error.stderr = res.stderr
    throw error
  }
  return res.stdout
}

// --- workspace -------------------------------------------------------------------------------

const packagesDir = join(root, 'packages')
const workspace = readdirSync(packagesDir)
  .filter((d) => existsSync(join(packagesDir, d, 'package.json')))
  .map((d) => {
    const file = join(packagesDir, d, 'package.json')
    const raw = readFileSync(file, 'utf8')
    return { dir: join(packagesDir, d), file, raw, json: JSON.parse(raw) }
  })
const published = workspace.filter((p) => !p.json.private)
const privateNames = new Set(workspace.filter((p) => p.json.private).map((p) => p.json.name))
const workspaceNames = new Set(workspace.map((p) => p.json.name))

const umbrella = workspace.find((p) => p.json.name === 'kitr')
if (!umbrella) throw new Error('packages/kitr not found')
for (const p of published) {
  if (!existsSync(join(p.dir, 'dist')))
    throw new Error(`${p.json.name} is not built: run pnpm build first`)
}
const version = `${umbrella.json.version.split('-')[0]}-smoke.${Date.now()}`

// --- registry --------------------------------------------------------------------------------

const work = mkdtempSync(join(tmpdir(), 'kitr-registry-smoke-'))
let verdaccio
let verdaccioOutput = ''

async function startRegistry() {
  const dir = join(work, 'verdaccio')
  mkdirSync(dir, { recursive: true })
  copyFileSync(join(root, 'scripts/verdaccio.yaml'), join(dir, 'config.yaml'))
  verdaccio = spawn(
    win ? 'npx.cmd' : 'npx',
    ['--yes', VERDACCIO, '--config', join(dir, 'config.yaml'), '--listen', String(port)],
    { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], shell: win },
  )
  const collect = (d) => {
    verdaccioOutput += d
  }
  verdaccio.stdout.on('data', collect)
  verdaccio.stderr.on('data', collect)
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    if (verdaccio.exitCode !== null) throw new Error(`verdaccio exited early:\n${verdaccioOutput}`)
    try {
      if ((await fetch(`${registryUrl}-/ping`)).ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`verdaccio did not start within 180s:\n${verdaccioOutput}`)
}

function stopRegistry() {
  if (!verdaccio || verdaccio.exitCode !== null) return
  if (win) {
    try {
      execFileSync('taskkill', ['/pid', String(verdaccio.pid), '/t', '/f'], { stdio: 'ignore' })
    } catch {}
  } else verdaccio.kill('SIGTERM')
}

// --- pack and publish ------------------------------------------------------------------------

const npmrc = join(work, 'publish.npmrc')
writeFileSync(npmrc, `registry=${registryUrl}\n//127.0.0.1:${port}/:_authToken=smoke\n`)

function packAndPublish() {
  const tarballs = join(work, 'tarballs')
  mkdirSync(tarballs)
  // One version everywhere, like the `fixed` group in .changeset/config.json. `pnpm pack`
  // rewrites `workspace:*` to the version in the sibling's package.json, so every package
  // (private ones too, they appear as peers) is bumped while packing and restored after.
  try {
    for (const p of workspace)
      writeFileSync(p.file, `${JSON.stringify({ ...p.json, version }, null, 2)}\n`)
    for (const p of published)
      sh('pnpm', ['pack', '--pack-destination', tarballs], { cwd: p.dir, capture: true })
  } finally {
    for (const p of workspace) writeFileSync(p.file, p.raw)
  }
  for (const p of published) {
    const file = join(tarballs, `${p.json.name.replace('@', '').replace('/', '-')}-${version}.tgz`)
    if (!existsSync(file)) {
      failures.push(`pnpm pack did not write ${file}`)
      continue
    }
    try {
      sh('npm', ['publish', file, '--userconfig', npmrc, '--tag', 'smoke', '--access', 'public'], {
        capture: true,
      })
    } catch (error) {
      failures.push(`publish ${p.json.name}: ${tail(error, 3)}`)
    }
  }
  console.log(`published ${published.length} packages at ${version}`)
}

// --- resolvability checks --------------------------------------------------------------------

const metaCache = new Map()
/** Abbreviated registry metadata for a package; cached, null when the registry has none. */
function metadata(name) {
  if (!metaCache.has(name))
    metaCache.set(
      name,
      fetch(`${registryUrl}${name.replace('/', '%2f')}`, {
        headers: { accept: 'application/vnd.npm.install-v1+json' },
      }).then((res) => (res.ok ? res.json() : null)),
    )
  return metaCache.get(name)
}

/** Why `name@range` cannot be installed from the registry, or null when it can. */
async function unresolvable(name, range) {
  if (/^(workspace|file|link):/.test(range)) return `${range} is a local reference`
  const meta = await metadata(name)
  if (!meta) return 'no such package on the registry'
  if (meta['dist-tags']?.[range]) return null
  const have = Object.keys(meta.versions ?? {})
  if (have.some((v) => semver.satisfies(v, range, { includePrerelease: true }))) return null
  return `no published version satisfies ${range} (latest is ${meta['dist-tags']?.latest})`
}

/** The CLI's pinned upstream set, read as text so no build or TypeScript loader is needed. */
function pinnedVersions() {
  const src = readFileSync(join(root, 'packages/cli/src/versions.ts'), 'utf8')
  const out = {}
  for (const [, name, range] of src.matchAll(/^\s*'?([@\w/.-]+)'?:\s*'([^']+)',?\s*$/gm))
    out[name] = range
  return out
}

async function checkResolvable() {
  const manifest = async (name) => {
    const meta = await metadata(name)
    return meta?.versions?.[version]
  }
  // Peers of the umbrella, as published (workspace:* became the smoke version).
  const packed = await manifest('kitr')
  const peers = packed?.peerDependencies ?? {}
  console.log(`kitr@${version} has ${Object.keys(peers).length} peer dependencies`)
  const skipped = []
  await Promise.all(
    Object.entries(peers).map(async ([name, range]) => {
      if (privateNames.has(name)) return skipped.push(name)
      if (name.startsWith('@kitr/') && !workspaceNames.has(name))
        return failures.push(`kitr peer ${name}@${range}: no such workspace package`)
      const problem = await unresolvable(name, range)
      if (problem) failures.push(`kitr peer ${name}@${range}: ${problem}`)
    }),
  )
  if (skipped.length)
    notes.push(
      `${skipped.length} optional peers of kitr are private (preview) packages, not published: ${skipped.join(', ')}`,
    )
  // Every other public package's dependencies and peers.
  await Promise.all(
    published.map(async (p) => {
      const m = await manifest(p.json.name)
      for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
        if (p.json.name === 'kitr' && field === 'peerDependencies') continue
        for (const [name, range] of Object.entries(m?.[field] ?? {})) {
          if (privateNames.has(name)) {
            failures.push(`${p.json.name} ${field}: ${name} is private and cannot be installed`)
            continue
          }
          const problem = await unresolvable(name, range)
          if (problem) failures.push(`${p.json.name} ${field} ${name}@${range}: ${problem}`)
        }
      }
    }),
  )
  // The pinned upstream set, and each package's `builtOn` (installed as `latest` without a pin).
  const pins = pinnedVersions()
  await Promise.all(
    Object.entries(pins).map(async ([name, range]) => {
      const problem = await unresolvable(name, range)
      if (problem) failures.push(`versions.ts ${name}@${range}: ${problem}`)
    }),
  )
  const builtOn = new Set(published.flatMap((p) => p.json.kitr?.builtOn ?? []))
  await Promise.all(
    [...builtOn]
      // `builtOn` also holds display names ("TanStack Query"); only npm names are checked.
      .filter((name) => !pins[name] && /^(@[a-z0-9-]+\/)?[a-z0-9._-]+$/.test(name))
      .map(async (name) => {
        const problem = await unresolvable(name, '*')
        if (problem) failures.push(`builtOn ${name}: ${problem}`)
      }),
  )
}

// --- projects --------------------------------------------------------------------------------

function installPublishedCli() {
  const tool = join(work, 'tool')
  mkdirSync(tool)
  writeFileSync(join(tool, 'package.json'), '{"name":"kitr-tool","private":true}\n')
  sh('npm', ['install', `kitr@${version}`, '--registry', registryUrl, '--no-audit', '--no-fund'], {
    cwd: tool,
  })
  return join(tool, 'node_modules/kitr/bin/kitr.mjs')
}

/** pnpm and npm read `npm_config_registry`, so every install the CLI runs hits Verdaccio. */
const projectEnv = () => ({
  npm_config_registry: registryUrl,
  // A user's shell is not CI: under CI pnpm refuses to update the lockfile that `kitr add` changes.
  CI: undefined,
  GITHUB_ACTIONS: undefined,
  NO_COLOR: '1',
})

function step(project, label, fn) {
  log(`${project}: ${label}`)
  const started = Date.now()
  try {
    fn()
    console.log(`    ok (${((Date.now() - started) / 1000).toFixed(1)}s)`)
    return true
  } catch (error) {
    failures.push(`${project}: ${label} failed: ${tail(error)}`)
    return false
  }
}

function smokeKit(kitr, kit) {
  const projects = join(work, 'projects')
  mkdirSync(projects, { recursive: true })
  const dir = join(projects, kit)
  const env = projectEnv()
  const components = join(root, 'registry/dist')
  const flags = existsSync(components) ? ['--registry', components] : []
  const created = step(kit, 'kitr new (installs from the registry)', () =>
    sh(process.execPath, [kitr, 'new', kit, '--kit', kit, '--pm', 'pnpm', '--no-git', ...flags], {
      cwd: projects,
      env,
    }),
  )
  if (!created) return
  const scripts = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).scripts ?? {}
  if (scripts.typecheck)
    step(kit, 'pnpm typecheck', () => sh('pnpm', ['run', 'typecheck'], { cwd: dir, env }))
  else failures.push(`${kit}: the project has no typecheck script`)
  if (scripts.build) step(kit, 'pnpm build', () => sh('pnpm', ['run', 'build'], { cwd: dir, env }))
  else failures.push(`${kit}: the project has no build script`)
  const lockFile = join(dir, 'pnpm-lock.yaml')
  const localRef = /(version|specifier): (link|file|workspace):|resolution: \{directory/
  if (existsSync(lockFile) && localRef.test(readFileSync(lockFile, 'utf8')))
    failures.push(`${kit}: pnpm-lock.yaml refers to a local path`)
}

function smokeAllPackages(kitr) {
  const projects = join(work, 'projects')
  mkdirSync(projects, { recursive: true })
  const dir = join(projects, 'all')
  const env = projectEnv()
  const names = published
    .map((p) => p.json.kitr)
    .filter((k) => k && !k.included && (k.kind ?? 'package') === 'package')
    .map((k) => k.name)
  const created = step('all', 'kitr new --kit blank', () =>
    sh(process.execPath, [kitr, 'new', 'all', '--kit', 'blank', '--pm', 'pnpm', '--no-git'], {
      cwd: projects,
      env,
    }),
  )
  if (!created) return
  // One package at a time, so a failure names the setup module that caused it.
  for (const name of names)
    step('all', `kitr add ${name}`, () =>
      sh(process.execPath, [kitr, 'add', name, '--yes'], { cwd: dir, env }),
    )
  step('all', 'pnpm typecheck', () => sh('pnpm', ['run', 'typecheck'], { cwd: dir, env }))
}

// --- main ------------------------------------------------------------------------------------

try {
  log(`starting ${VERDACCIO} on ${registryUrl}`)
  await startRegistry()
  log(`packing and publishing ${published.length} packages as ${version}`)
  packAndPublish()
  log('checking that every peer, dependency and pinned upstream version resolves')
  await checkResolvable()
  if (!opts['skip-projects']) {
    log('installing the published CLI')
    const kitr = installPublishedCli()
    for (const kit of opts.kits.split(',').filter(Boolean)) smokeKit(kitr, kit)
    if (opts['all-packages']) smokeAllPackages(kitr)
  }
} catch (error) {
  failures.push(error.stderr !== undefined ? tail(error) : String(error.stack ?? error))
} finally {
  stopRegistry()
  if (opts.keep) console.log(`\nkept ${work}`)
  else
    try {
      rmSync(work, { recursive: true, force: true, maxRetries: 3 })
    } catch {}
}

for (const note of notes) console.log(`\nnote: ${note}`)
if (failures.length) {
  console.error(`\nRegistry smoke test failed (${failures.length}):`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('\nRegistry smoke test passed.')
process.exit(0)
