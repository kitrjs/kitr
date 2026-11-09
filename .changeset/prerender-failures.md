---
"@kitr/vite": patch
"@kitr/seo": patch
---

A page that fails to prerender no longer kills the build with a dump of the `Response`. The build prints one line, `[prerender] 404 at /llms-full.txt, linked from /docs/agents`, and leaves the page out of the sitemap. A route listed in `config/seo.ts` `prerender.routes` still fails the build; a crawled link only warns, unless `prerender.failOnError` is `true`.
