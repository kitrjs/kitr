---
"@kitr/seo": patch
---

`seo(options, ctx)` builds the canonical URL and `og:url` from `site.url` plus the matched path when `url` is left out, instead of pointing every page at the home page. It also takes `title` and `description` from the loader's data when the options leave them out, so `head: (ctx) => seo({}, ctx)` is enough for a page whose loader returns them.
