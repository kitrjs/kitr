// Serves site/dist/client the way site/nginx.conf does in production, so browser tests see
// what kitr.dev serves: prerendered <path>/index.html, <url>.md as markdown, immutable
// assets, and the app shell for anything else (the client renders the 404 page).
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../site/dist/client', import.meta.url))
const port = Number(process.argv[2] ?? 4413)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

const file = (rel) => {
  const full = normalize(join(root, rel))
  if (!full.startsWith(root)) return undefined
  return existsSync(full) && statSync(full).isFile() ? full : undefined
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
  let found
  if (path.endsWith('.md') || path.startsWith('/assets/')) found = file(path)
  else
    found =
      file(path) ?? file(join(path, 'index.html')) ?? file(`${path}.html`) ?? file('index.html')
  if (!found) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found')
    return
  }
  res.writeHead(200, {
    'content-type': types[extname(found)] ?? 'application/octet-stream',
    'cache-control': path.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=0, must-revalidate',
  })
  createReadStream(found).pipe(res)
}).listen(port, '127.0.0.1', () => console.log(`site on http://127.0.0.1:${port}`))
