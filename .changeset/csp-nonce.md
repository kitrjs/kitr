---
'@kitr/shield': minor
'@kitr/server': minor
'@kitr/router': patch
'@kitr/theme': patch
---

The default Content-Security-Policy no longer allows `'unsafe-inline'` for scripts or style elements. `securityHeaders()` makes a random nonce for every response, puts `'nonce-<value>'` in `script-src` and `style-src`, and stores it in the request context (`RequestContext.nonce` in `@kitr/server`). `DEFAULT_CSP` is now a template with `{nonce}`, and a custom `contentSecurityPolicy` string may use `{nonce}` too. New: `useCspNonce()` and `getCspNonce(event)` to read it, `defaultCsp()`, `headers.strictDynamic` (adds `'strict-dynamic'`) and `headers.unsafeInline` (the old policy, for widgets that inject inline tags). Inline `style=""` attributes stay allowed through `style-src-attr`, and outside production styles allow `'unsafe-inline'` because Vite's dev server injects unnonced `<style>` tags. `server.fetch(request, { pages })` runs page requests through the server's middleware so pages get the shield's headers and the nonce (new apps' `app/server.ts` uses it; an old one keeps working without them). `createKitrRouter` sets `router.options.ssr.nonce` so TanStack Start's hydration scripts carry it, `<ThemeScript />` puts it on its script and style, and the theme provider gives sonner's injected stylesheet the page's nonce. Shield's rate limit and CSRF check skip page requests.
