import { definePackage } from '@kitr/core/package'

/** `kitr add shield`: CORS, CSRF protection, safe headers and rate limits on the server. */
export default definePackage({
  name: 'shield',
  requires: ['server'],
  add(ctx) {
    ctx.provider.add('@kitr/shield/provider')
    ctx.config(
      'shield',
      `import { defineConfig } from '@kitr/shield'\n\nexport default defineConfig({\n  headers: {}, // sensible security headers; set contentSecurityPolicy to tighten\n  cors: false, // { origin: ['https://app.example.com'], credentials: true } for a separate front end\n  rateLimit: { max: 300, windowMs: 60_000 }, // per IP per minute\n  csrf: {}, // double-submit cookie; @kitr/http sends the token on every non-GET request\n})\n`,
    )
    ctx.server.attach({
      marker: 'shield(server',
      import: "import { shield } from '@kitr/shield'",
      line: '// Security headers, CORS, rate limit and CSRF from config/shield.ts.\nshield(server)',
      first: true,
    })
    ctx.agents.add(
      'shield',
      `- \`shield(server)\` in \`server/main.ts\` applies \`config/shield.ts\`: security headers, CORS, rate limiting and CSRF. Rate-limited requests get 429 with RateLimit-* headers; CSRF failures get 403. Do not add helmet/cors by hand; tune the config instead.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/shield/provider')
    ctx.agents.remove('shield')
  },
  vite: { serverOnlyConfig: true },
})
