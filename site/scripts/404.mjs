// After the prerender: dist/client/404.html, the not-found page nginx answers unknown URLs
// with (status 404). The module script is removed so the client doesn't try to hydrate a
// /404 route at some other URL; the page is plain HTML and its links still work.
import { readFileSync, writeFileSync } from 'node:fs'

const dist = new URL('../dist/client/', import.meta.url)
const html = readFileSync(new URL('404/index.html', dist), 'utf8')
writeFileSync(new URL('404.html', dist), html.replace(/<script type="module"[^>]*><\/script>/g, ''))
