// Usage: node tests/e2e/prepare.mjs <example> <copy-name> [--build]
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

const fixtures = join(root, 'tests/e2e/fixtures', example)
if (existsSync(fixtures)) cpSync(fixtures, join(target, 'app'), { recursive: true })

// Fixture API route: lets a test push an event down a socket channel.
const routesFile = join(target, 'app/api/routes.ts')
if (existsSync(routesFile) && existsSync(join(target, 'app/api/socket.ts'))) {
  let src = readFileSync(routesFile, 'utf8')
  src = `import { exampleChannel } from '#app/channels/example'\nimport { sockets } from '#app/api/socket'\n${src}`
  src = src.replace(
    "api.get('/health'",
    "api.post('/e2e/emit', async (ctx) => { const body = ctx.body as { room: string; text: string }; sockets.use(exampleChannel, { room: body.room }).emit('message', body.text); return { sent: true } }, { name: 'e2e.emit' })\n      .get('/health'",
  )
  writeFileSync(routesFile, src)
}

if (flags.includes('--build')) {
  execFileSync(join(root, 'node_modules/.bin/vite'), ['build', '--logLevel', 'warn'], {
    cwd: target,
    stdio: 'inherit',
  })
}
