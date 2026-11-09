---
"@kitr/vite": patch
---

The sitemap lists only indexable HTML pages. A crawled `.md`, `.txt` or `.json` file (a "view as markdown" copy, `llms.txt`) and a page whose head says `<meta name="robots" content="noindex">` are still written, but no longer appear in `sitemap.xml`.
