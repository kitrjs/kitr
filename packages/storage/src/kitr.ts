import { definePackage } from '@kitr/core/package'

/** `kitr add storage`: typed localStorage/sessionStorage items and cookies with one API on the client and the server. */
export default definePackage({
  name: 'storage',
  add(ctx) {
    const serverOnly = ctx.isServerOnly
    ctx.provider.add('@kitr/storage/provider')
    ctx.config(
      'storage',
      `import { defineConfig } from '@kitr/storage'

export default defineConfig({
  // Prefixes every storage key and cookie name so several apps on one origin never collide.
  prefix: '${(ctx.pkg.name ?? 'app').replace(/^@[^/]+\//, '').replace(/[^a-z0-9]+/gi, '-')}:',
  cookie: { path: '/', sameSite: 'lax', secure: import.meta.env?.PROD ?? false },
})
`,
    )
    ctx.write(
      'app/storage.ts',
      serverOnly
        ? `import { defineCookie } from '@kitr/storage'

/** Cookies are typed once and read with \`cookies(event).get(item)\` from @kitr/storage/server. */
export const localeCookie = defineCookie('locale', { default: 'en', maxAge: 60 * 60 * 24 * 365 })
`
        : `import { defineCookie } from '@kitr/storage'

/**
 * Every persisted value, in one file, typed. Components read them with
 * \`useStorage(item)\` / \`useCookie(item)\` from @kitr/storage/react; plain code with \`item.get()\`.
 * A local or session storage value is declared the same way:
 *
 *   import { defineStorage } from '@kitr/storage'
 *
 *   export const sidebar = defineStorage('sidebar', { default: { collapsed: false } })
 *   export const recentSearches = defineStorage<string[]>('recent-searches', {
 *     default: [],
 *     area: 'session',
 *   })
 */

/** Readable on the server too (\`localeCookie.get(request.headers)\`), so SSR picks the right locale. */
export const localeCookie = defineCookie('locale', { default: 'en', maxAge: 60 * 60 * 24 * 365 })
`,
    )
    ctx.agents.add(
      'storage',
      serverOnly
        ? `- Cookies: declare with \`defineCookie\` in \`app/storage.ts\`; in controllers use \`const jar = cookies(ctx.event)\` from \`@kitr/storage/server\`, then \`jar.get(item)\` / \`jar.set(item, value, { httpOnly: true })\`.`
        : `- Persisted values are declared once in \`app/storage.ts\` (\`defineStorage\` for local/session storage, \`defineCookie\` for cookies) and never read through \`localStorage\`/\`document.cookie\` directly.\n- Components: \`const [value, setValue] = useStorage(item)\` / \`useCookie(item)\` from \`@kitr/storage/react\`. Both are hydration-safe: the server and first render see the default.\n- Server side (actions, controllers): \`cookies(event).get(item)\` / \`.set(item, value)\` from \`@kitr/storage/server\`; wrap the root route in \`<CookieHeader value={request.headers.get('cookie')}>\` so \`useCookie\` renders the right value during SSR.\n- Add \`schema\` (zod/valibot) to validate what comes back from storage, \`version\` + \`migrate\` when a shape changes, \`ttl\` to expire.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/storage/provider')
    ctx.agents.remove('storage')
  },
  eject: { '@kitr/storage': 'localStorage / document.cookie (+ a cookie parser)' },
})
