// Usage: node tests/e2e/prepare.mjs <example> <copy-name> [--build] [--add <package>]
// Copies examples/<example> to $TMPDIR/kitr-e2e-apps/<copy-name> with its installed node_modules
// symlinked in, adds the e2e fixture files from tests/e2e/fixtures/<example>, and optionally
// builds it. The examples themselves stay the untouched output of `kitr new`.
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// `--add <pkg>`: a preview package no kit installs (devtools), added the way a user would with
// `kitr add <pkg> --preview`, and linked from the workspace.
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
    [join(root, 'packages/kitr/bin/kitr.mjs'), 'add', pkg, '--preview', '--no-install', '--yes'],
    { cwd: target, stdio: 'inherit', env: { ...process.env, CI: '1' } },
  )
}

const fixtures = join(root, 'tests/e2e/fixtures', example)
if (existsSync(fixtures)) cpSync(fixtures, join(target, 'app'), { recursive: true })

// Fixture pages: the fixture ships page components under app/pages/e2e; link them into the
// app's route table the way `kitr make:page` would, after the kit's own pages.
const appRoutes = join(target, 'app/routes.ts')
if (existsSync(appRoutes) && existsSync(join(target, 'app/pages/e2e'))) {
  let src = readFileSync(appRoutes, 'utf8')
  const anchor = ".page('/about', { lazy: () => import('./pages/about') })"
  if (!src.includes(anchor))
    throw new Error(`prepare: ${appRoutes} has no /about page to link after`)
  src = `import { meQuery } from '#app/e2e/me-query'\n${src}`
  src = src.replace(
    anchor,
    `${anchor}
    .page('/e2e/counter', { lazy: () => import('./pages/e2e/counter') })
    .page('/e2e/me', {
      loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
      lazy: () => import('./pages/e2e/me'),
    })
    .page('/e2e/socket', { lazy: () => import('./pages/e2e/socket') })`,
  )
  writeFileSync(appRoutes, src)
}

// Fixture API route: lets a test push an event down a socket channel through the realtime
// server the table's `.ws` link binds in the container.
const routesFile = join(target, 'server/routes.ts')
if (existsSync(routesFile) && existsSync(fixtures)) {
  let src = readFileSync(routesFile, 'utf8')
  const anchor = "r.get('/health'"
  if (!src.includes(anchor))
    throw new Error(`prepare: ${routesFile} has no /health route to link before`)
  src = src.replace(
    anchor,
    `r.post('/e2e/emit', async (ctx) => { const body = ctx.body as { room: string; text: string }; ctx.app.container.use('realtime').use(exampleChannel, { room: body.room }).emit('message', body.text); return { sent: true } }, { name: 'e2e.emit' })
      .get('/health'`,
  )
  writeFileSync(routesFile, src)
}

if (flags.includes('--build')) {
  execFileSync(process.execPath, [join(root, 'packages/kitr/bin/kitr.mjs'), 'build', 'site'], {
    cwd: target,
    stdio: 'inherit',
  })
}
