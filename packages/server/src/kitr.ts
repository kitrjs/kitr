import { definePackage } from '@kitr/core/package'
import { server } from './platform'

/**
 * `kitr add server`: the server runtime on h3 (request context, errors, lifecycle) with its
 * config. It is also a platform: `kitr add server api --runtime node` writes `server/main.ts`
 * and the `dev`/`build`/`start` scripts for it.
 */
export default definePackage({
  name: 'server',
  kind: 'platform',
  requires: ['logger'],
  platform: { factory: server, export: 'server', from: 'kitr/server', defaultName: 'api' },
  add(ctx) {
    ctx.deps.add('h3', 'srvx')
    ctx.config(
      'server',
      `import { defineConfig } from 'kitr/server'\n\nexport default defineConfig({\n  healthPath: '/healthz',\n  bodyLimit: 1024 * 1024,\n})\n`,
    )
    ctx.env.add({ LOG_LEVEL: 'info' }, 'Server')
    // With React, `kitr add react` wrote app/env.ts; a pure backend gets its typed env here.
    if (!(ctx.has('react') || ctx.hasPackage('react')))
      ctx.write(
        'app/env.ts',
        `import { createEnv, env as e } from 'kitr/env'\n\nexport const env = createEnv({\n  server: {\n    PORT: e.number({ default: 3000 }),\n    LOG_LEVEL: e.enum(['debug', 'info', 'warn', 'error'], { default: 'info' }),\n  },\n})\n`,
      )
    if (!Object.values(ctx.rc.platforms).some((p) => p.factory === 'server'))
      ctx.log.info('Run the server as a platform: `kitr add server api` (writes server/main.ts).')
    ctx.agents.add(
      'server',
      `- Server code lives under \`server/\` and never imports React. Services come from the request-scoped container (\`useRequestApp()\`), logs from \`ctx.logger\`.\n- \`server/main.ts\` (written by the server platform) exports \`server\`; providers' \`ready\`/\`shutdown\` run on \`server.listen()\`. A web platform in \`ssr\` mode answers \`/api/*\` through the same object via \`app/routes/api.$.ts\`.`,
    )
  },
  remove(ctx) {
    ctx.deps.remove('h3', 'srvx')
    ctx.agents.remove('server')
  },
  wraps: { h3: 'kitr/server' },
  eject: { 'kitr/server': 'h3 + srvx' },
  vite: { serverOnlyConfig: true },
})
