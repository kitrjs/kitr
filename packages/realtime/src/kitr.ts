import { definePackage, naming } from '@kitr/core/package'

/** `kitr add realtime`: typed channels over WebSocket (default), Socket.IO or SSE, feeding the query cache. */
export default definePackage({
  name: 'realtime',
  requires: ['server'],
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
    ctx.write(
      'server/realtime.ts',
      `import { createRealtimeServer } from 'kitr/realtime/server'\nimport { exampleChannel } from '#app/channels/example'\n\n/** Attached in server/main.ts; from a controller: realtime.use(exampleChannel, { room }).emit('message', data) */\nexport const realtime = createRealtimeServer({\n  channels: [exampleChannel],\n  // authorize: (request) => verify(request.headers.get('authorization')),\n})\n`,
    )
    // The server platform wrote server/main.ts first: attach the socket server next to the routes.
    const configuredPath = ctx.exists('config/realtime.ts')
      ? (ctx.read('config/realtime.ts').match(/path\s*:\s*['"]([^'"]+)['"]/)?.[1] ?? path)
      : path
    ctx.server.attach({
      marker: 'realtime.attach',
      import: serverOnly
        ? "import { realtime } from './realtime'"
        : "import { realtime } from '#server/realtime'",
      line: `// WebSocket upgrades on ${configuredPath}, next to the routes.\nrealtime.attach(server, '${configuredPath}')`,
    })
    if (!serverOnly)
      ctx.write(
        'app/realtime.ts',
        `import { createRealtimeClient, type SocketTransport } from 'kitr/realtime'\nimport realtimeConfig from '#config/realtime'\n\nlet transport: SocketTransport | undefined\n\n/** One connection per tab, opened on first use (so nothing connects during SSR). */\nexport function realtime(): SocketTransport {\n  transport ??= createRealtimeClient(realtimeConfig)\n  return transport\n}\n`,
      )
    ctx.agents.add(
      'realtime',
      `- Channels are defined once in \`app/channels/*.ts\` with \`defineChannel\`. The server emits with \`realtime.use(channel, params).emit(event, data)\` (server/realtime.ts); components subscribe with \`useChannel(realtime(), channel, params)\` from \`kitr/realtime/react\` and events update the query cache via \`effects\`.\n- Switch transports in \`config/realtime.ts\`: \`socket.io\` (rooms, adapters; client from \`kitr/realtime/socket.io\`) or \`sse\` (plain HTTP, no upgrade; server from \`kitr/realtime/sse/server\`).`,
    )
  },
  remove(ctx) {
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
  vite: { optimizeDeps: ['partysocket'] },
})
