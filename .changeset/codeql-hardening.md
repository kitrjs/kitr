---
"@kitr/mail": patch
"@kitr/cli": patch
"@kitr/content": patch
"@kitr/seo": patch
"@kitr/vite": patch
"@kitr/mobile": patch
---

Hardening from a CodeQL pass. `@kitr/mail` parses recipients and builds the text body by scanning instead of backtracking regexes, so long or malformed input no longer stalls a send, and `htmlToText` now drops `<SCRIPT>` and `</script >` too. `kitr add` refuses a package name that is not a plain npm name before running the installer. Frontmatter, `seo` canonical URLs and the prerender link crawl no longer use regexes that slow down on long input. The generated `capacitor.config.ts` escapes backslashes in the app name.
