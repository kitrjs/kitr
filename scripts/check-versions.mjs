// The upstream versions `kitr new` and `kitr upgrade` write (packages/cli/src/versions.ts) must be
// the ones this repo is built and tested with. Fails when, for a library in that table:
//
//   1. a workspace package.json (root, packages, examples, registry, site) declares a range in
//      dependencies, devDependencies or optionalDependencies that cannot overlap the one in
//      versions.ts (another major, or a pre-1.0 minor apart),
//   2. the lockfile resolved a version outside the range in versions.ts, or
//   3. the lockfile's specifier for a manifest entry no longer matches that manifest (stale lock).
//
// Ranges that overlap (`^2.0.7` against `^2.0.8`, `1.1.10` against `^1.1.10`) are fine: manifests
// inside this repo may lag a patch behind or pin exactly. Peer ranges are left alone too, since a
// package may accept a wider range than the one kitr installs.
// A new bump is one edit in versions.ts plus `pnpm update <name>`; Renovate opens both together.
//
//   node scripts/check-versions.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import semver from 'semver'

const root = fileURLToPath(new URL('..', import.meta.url))
const failures = []

/** versions.ts is a plain `name: 'range'` table; read it as text so no build is needed. */
function readPinned() {
  const src = readFileSync(join(root, 'packages/cli/src/versions.ts'), 'utf8')
  const body = src.slice(src.indexOf('= {'), src.indexOf('\n}\n'))
  const out = {}
  for (const [, name, range] of body.matchAll(/^\s*'?([@\w/.-]+)'?:\s*'([^']+)',?\s*$/gm))
    out[name] = range
  if (!Object.keys(out).length) throw new Error('no versions found in packages/cli/src/versions.ts')
  return out
}

/** Workspace manifests by importer path as the lockfile spells it (`.`, `packages/cli`...). */
function readManifests() {
  const out = {}
  const add = (importer, dir) => {
    const file = join(root, dir, 'package.json')
    if (existsSync(file)) out[importer] = JSON.parse(readFileSync(file, 'utf8'))
  }
  add('.', '.')
  for (const group of ['packages', 'examples'])
    if (existsSync(join(root, group)))
      for (const d of readdirSync(join(root, group))) add(`${group}/${d}`, join(group, d))
  add('registry', 'registry')
  add('site', 'site')
  return out
}

/** `importers:` of pnpm-lock.yaml as { importer: { name: { specifier, version } } }. */
function readLockImporters() {
  const lines = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8').split('\n')
  const out = {}
  let inImporters = false
  let importer
  let dep
  for (const line of lines) {
    if (/^\S/.test(line)) {
      inImporters = line.startsWith('importers:')
      continue
    }
    if (!inImporters) continue
    let m = line.match(/^ {2}(\S.*):$/)
    if (m) {
      importer = m[1].replace(/^'|'$/g, '')
      out[importer] = {}
      continue
    }
    m = line.match(/^ {6}(\S.*):$/)
    if (m) {
      dep = m[1].replace(/^'|'$/g, '')
      out[importer][dep] = {}
      continue
    }
    m = line.match(/^ {8}(specifier|version): (.*)$/)
    if (m && dep) out[importer][dep][m[1]] = m[2].replace(/^'|'$/g, '')
  }
  return out
}

/** Can any version satisfy both ranges? Unparseable ranges (tags, urls) count as a mismatch. */
function overlaps(a, b) {
  try {
    return semver.intersects(a, b)
  } catch {
    return a === b
  }
}

const pinned = readPinned()
const manifests = readManifests()
const lock = readLockImporters()
const fields = ['dependencies', 'devDependencies', 'optionalDependencies']
let checked = 0

for (const [name, range] of Object.entries(pinned)) {
  for (const [importer, manifest] of Object.entries(manifests)) {
    for (const field of fields) {
      const declared = manifest[field]?.[name]
      if (declared === undefined) continue
      checked++
      if (!declared.startsWith('workspace:') && !overlaps(declared, range))
        failures.push(
          `${importer}/package.json ${field}.${name} is ${declared}, versions.ts says ${range}`,
        )
    }
  }
  for (const [importer, deps] of Object.entries(lock)) {
    const entry = deps[name]
    if (!entry) continue
    const manifest = manifests[importer]
    const declared = fields.map((f) => manifest?.[f]?.[name]).find((v) => v !== undefined)
    if (declared !== undefined && entry.specifier !== declared)
      failures.push(
        `pnpm-lock.yaml ${importer}: ${name} has specifier ${entry.specifier} but package.json says ${declared} (run pnpm install)`,
      )
    const resolved = entry.version?.split('(')[0]
    if (resolved && semver.valid(resolved) && !semver.satisfies(resolved, range))
      failures.push(
        `pnpm-lock.yaml ${importer}: ${name} resolved to ${resolved}, outside versions.ts range ${range}`,
      )
  }
}

if (failures.length) {
  console.error(`versions.ts is out of step with the workspace (${failures.length}):`)
  for (const f of [...new Set(failures)]) console.error(`  - ${f}`)
  console.error(
    '\nBump packages/cli/src/versions.ts and the manifests together (pnpm update <name> -r), then pnpm install.',
  )
  process.exit(1)
}
console.log(
  `versions.ts: ${Object.keys(pinned).length} pinned libraries, ${checked} manifest entries, all match the lockfile.`,
)
