// Usage: node tests/e2e/prepare.mjs <example> <copy-name> [--build]
// Copies examples/<example> to tests/e2e/.apps/<copy-name> with its installed node_modules
// symlinked in, adds the e2e fixture files from tests/e2e/fixtures/<example>, and optionally
// builds it. The examples themselves stay the untouched output of `kitr new`.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const [example, name = example, ...flags] = process.argv.slice(2)
const source = join(root, 'examples', example)
const target = join(root, 'tests/e2e/.apps', name)

rmSync(target, { recursive: true, force: true })
cpSync(source, target, {
  recursive: true,
  filter: (src) => !/^(node_modules|dist|\.output|\.tanstack|\.nitro)(\/|$)/.test(relative(source, src)),
})
symlinkSync(join(source, 'node_modules'), join(target, 'node_modules'), 'dir')

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
