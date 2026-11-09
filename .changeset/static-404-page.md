---
"@kitr/vite": patch
"@kitr/web": patch
---

A `static` web build writes `404.html` from the root route's `notFoundComponent`, which Netlify, Cloudflare Pages and GitHub Pages serve for unknown paths. `kitr start` serves it with status 404 in `static` mode; `spa` mode keeps answering unknown paths with the shell and status 200.
