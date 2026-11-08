// Usage: node tests/e2e/prepare.mjs <example> <copy-name> [--build] [--add <package>] [--variant <name>]
// Copies examples/<example> to $TMPDIR/kitr-e2e-apps/<copy-name> with its installed node_modules
// symlinked in, adds the e2e fixture files from tests/e2e/fixtures/<example>, and optionally
// builds it. The examples themselves stay the untouched output of `kitr new`.
//
// A fixture directory holds the files copied into the app (pages, stores) and, optionally, a
// `patch.mjs` that links them into the app (route table, server routes) and a `variant-<name>.mjs`
// for each `--variant <name>`: the same kit wired differently (the realtime kit over SSE).
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { withBuildSlot } from './build-slots.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const [example, name = example, ...flags] = process.argv.slice(2)
const source = join(root, 'examples', example)
// Outside the repo: inside it, the repo's .gitignore changes what Tailwind scans, and the
// client and server builds then disagree on the stylesheet's hash.
export const appsDir = join(tmpdir(), 'kitr-e2e-apps')
const target = join(appsDir, name)

rmSync(target, { recursive: true, force: true })
cpSync(source, target, {
  recursive: true,
  filter: (src) =>
    !/^(node_modules|dist|\.output|\.tanstack|\.nitro)(\/|$)/.test(relative(source, src)),
})
// Link each installed package, but keep node_modules itself per copy: Vite and Tailwind write
// caches there (.vite, .cache), and copies building in parallel must not share them.
mkdirSync(join(target, 'node_modules'))
for (const entry of readdirSync(join(source, 'node_modules'))) {
  if (entry.startsWith('.')) continue
  symlinkSync(join(source, 'node_modules', entry), join(target, 'node_modules', entry), 'dir')
}
const bin = join(source, 'node_modules/.bin')
if (existsSync(bin)) symlinkSync(bin, join(target, 'node_modules/.bin'), 'dir')

// `--add <pkg>`: a package no kit installs (devtools), added the way a user would with
// `kitr add <pkg>`, and linked from the workspace.
for (let i = 0; i < flags.length; i++) {
  if (flags[i] !== '--add') continue
  const pkg = flags[++i]
  const scope = join(target, 'node_modules/@kitr')
  const linked = join(source, 'node_modules/@kitr')
  rmSync(scope, { recursive: true, force: true })
  mkdirSync(scope)
  for (const entry of readdirSync(linked))
    symlinkSync(join(linked, entry), join(scope, entry), 'dir')
  symlinkSync(join(root, 'packages', pkg), join(scope, pkg), 'dir')
  execFileSync(
    process.execPath,
    [join(root, 'packages/kitr/bin/kitr.mjs'), 'add', pkg, '--no-install', '--yes'],
    { cwd: target, stdio: 'inherit', env: { ...process.env, CI: '1' } },
  )
}

// Fixture files go under app/, then the example's patch links them in.
const fixtures = join(root, 'tests/e2e/fixtures', example)
if (existsSync(fixtures)) {
  cpSync(fixtures, join(target, 'app'), {
    recursive: true,
    filter: (src) => !/(^|\/)(patch|variant-[\w-]+)\.mjs$/.test(relative(fixtures, src)),
  })
  const run = async (file) => {
    if (!existsSync(file)) return
    const { default: patch } = await import(pathToFileURL(file).href)
    await patch({ target, root, name })
  }
  await run(join(fixtures, 'patch.mjs'))
  const variant = flags.indexOf('--variant')
  if (variant !== -1) {
    const file = join(fixtures, `variant-${flags[variant + 1]}.mjs`)
    if (!existsSync(file))
      throw new Error(`prepare: no variant "${flags[variant + 1]}" for ${example}`)
    await run(file)
  }
}

if (flags.includes('--build')) {
  // Builds are heavy and several apps prepare at once: a few at a time keeps each of them from
  // starving the others (a prerender that cannot reach its own server in time fails the build).
  await withBuildSlot(appsDir, () =>
    execFileSync(process.execPath, [join(root, 'packages/kitr/bin/kitr.mjs'), 'build', 'site'], {
      cwd: target,
      stdio: 'inherit',
    }),
  )
}
