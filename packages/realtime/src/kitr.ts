import { definePackage, naming } from '@kitr/core/package'

/** `kitr add realtime`: typed channels over WebSocket (default), Socket.IO or SSE, feeding the query cache. */
export default definePackage({
  name: 'realtime',
  requires: ['server'],
  routes: 'kitr/realtime/routes',
  add(ctx) {
    const serverOnly = !(ctx.has('react') || ctx.hasPackage('react'))
    const path = serverOnly ? '/ws' : '/api/ws'
    ctx.deps.add('crossws', ...(serverOnly ? [] : ['partysocket']))
    ctx.config(
      'realtime',
      `import { defineConfig } from 'kitr/realtime'\n\nexport default defineConfig({\n  // websocket (default), socket.io or sse: the channels and hooks stay the same.\n  transport: 'websocket',\n  path: '${path}',\n})\n`,
    )
    ctx.write(
      'app/channels/example.ts',
      `import { defineChannel } from 'kitr/realtime'\n\n/** One definition for both ends. The client applies \`effects\`; the server checks \`authorize\`. */\nexport const exampleChannel = defineChannel<{ room: string }>({\n  name: 'example',\n  events: {\n    message: { effects: () => ({ invalidate: [['messages']] }) },\n  },\n  authorize: () => true,\n})\n`,
    )
    // The socket is a route on the server table: `.ws(path, { channels })` from kitr/realtime/routes.
    // `createServer({ routes })` mounts it, and binds the first socket server as `realtime` in the
    // container, so controllers and jobs emit through `app.container.use('realtime')`.
    const configuredPath = ctx.exists('config/realtime.ts')
      ? (ctx.read('config/realtime.ts').match(/path\s*:\s*['"]([^'"]+)['"]/)?.[1] ?? path)
      : path
    ctx.routes.extend('kitr/realtime/routes', { table: 'server' })
    const link = `.ws('${configuredPath}', { channels: [exampleChannel] /* , authorize: (request) => ... */ })`
    if (
      !ctx.routes.append(link, {
        table: 'server',
        imports: [{ from: '#app/channels/example', local: 'exampleChannel' }],
        skipIf: /\.(ws|sse)\(/,
      })
    )
      ctx.log.warn(`The server route table is not a method chain; add \`${link}\` to it by hand.`)
    if (!serverOnly)
      ctx.write(
        'app/realtime.ts',
        `import { createRealtimeClient, type SocketTransport } from 'kitr/realtime'\nimport realtimeConfig from '#config/realtime'\n\nlet transport: SocketTransport | undefined\n\n/** One connection per tab, opened on first use (so nothing connects during SSR). */\nexport function realtime(): SocketTransport {\n  transport ??= createRealtimeClient(realtimeConfig)\n  return transport\n}\n`,
      )
    ctx.agents.add(
      'realtime',
      `- Channels are defined once in \`app/channels/*.ts\` with \`defineChannel\` and served by \`.ws(path, { channels })\` (or \`.sse\`) on the server route table (\`server/routes.ts\`, methods from \`kitr/realtime/routes\`). The server emits with \`app.container.use('realtime').use(channel, params).emit(event, data)\` (\`{ app }\` is on every HttpContext and job); components subscribe with \`useChannel(realtime(), channel, params)\` from \`kitr/realtime/react\` and events update the query cache via \`effects\`.\n- Switch transports in \`config/realtime.ts\`: \`socket.io\` (rooms, adapters; client from \`kitr/realtime/socket.io\`) or \`sse\` (plain HTTP, no upgrade; server from \`kitr/realtime/sse/server\`).`,
    )
  },
  remove(ctx) {
    ctx.routes.remove('kitr/realtime/routes', { table: 'server' })
    const table = ctx.rc.directories.serverRouteTable ?? `${ctx.rc.directories.server ?? 'server'}/routes.ts`
    if (ctx.exists(table) && /\.(ws|sse)\(/.test(ctx.read(table)))
      ctx.log.warn(`${table} still has .ws()/.sse() links; remove them, the extension is gone.`)
    ctx.deps.remove('crossws', 'partysocket', 'socket.io', 'socket.io-client')
    ctx.agents.remove('realtime')
  },
  generators: {
    channel: {
      description: 'Create a socket channel in app/channels',
      target: (name, project) => ({
        file: `${project.rc.directories.app ?? 'app'}/channels/${naming.snake(name)}.ts`,
      }),
      stub: ({ name }) => `import { defineChannel } from 'kitr/realtime'
import { z } from 'zod'

export const ${naming.camel(name)}Channel = defineChannel({
  name: '${naming.snake(name)}',
  params: z.object({ id: z.string() }),
  events: {
    updated: {
      effects: (data: unknown, { id }) => ({ set: [{ key: ['${naming.snake(name)}', 'detail', id], data }] }),
    },
    deleted: {
      effects: () => ({ invalidate: [['${naming.snake(name)}', 'list']] }),
    },
  },
  authorize: () => true,
})
`,
    },
  },
  eject: { 'kitr/realtime': 'partysocket + crossws (or socket.io, or EventSource)' },
  vite: { optimizeDeps: ['partysocket/ws', 'socket.io-client'] },
})
