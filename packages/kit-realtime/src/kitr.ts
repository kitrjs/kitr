import { type AddContext, definePackage } from '@kitr/core/package'

const write = (ctx: AddContext, path: string, content: string) =>
  ctx.write(path, content, { overwrite: true })

const remove = (ctx: AddContext, ...paths: string[]) => {
  for (const p of paths) ctx.unlink(p)
}

const addScript = (ctx: AddContext, name: string, command: string) => ctx.scripts.add(name, command)

const documentModule = (options: {
  imports: string
  head: string
  body: string
  extra?: string
  /** Statements at the top of RootDocument. */
  prelude?: string
  /** Opening and closing JSX around the body. */
  wrap?: [open: string, close: string]
}) =>
  `import { HeadContent, Outlet, Scripts } from 'kitr/router'
import { ThemeScript } from 'kitr/theme'
import css from '#app/styles/app.css?url'
${options.imports}
/** Head tags for every page. Pages add their own with \`head\` on their route in app/routes.ts. */
export function head() {
  return {
${options.head}
    links: [{ rel: 'stylesheet', href: css }],
  }
}

/** The HTML shell. Start streams it on the server and hydrates it on the client. */
export function RootDocument() {
${options.prelude ?? ''}  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
${options.wrap ? `  ${options.wrap[0]}\n` : ''}${options.body.replace(/^/gm, '  ')}
${options.wrap ? `  ${options.wrap[1]}\n` : ''}        <Scripts />
      </body>
    </html>
  )
}
${options.extra ?? ''}`

const routeTable = (routes: Array<[name: string, method: string, path: string]>) =>
  `// Route table for the typed client. Regenerate with \`kitr api:sync\`.\nexport const routeTable = ${JSON.stringify(
    routes.map(([name, method, path]) => ({ name, method, path })),
    null,
    2,
  )} as const\n`

function displayName(name: string) {
  return name
    .replace(/^@[^/]+\//, '')
    .replace(/^example-/, '')
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
}

const apiClient = `import { createApiClient, registerRoutes } from 'kitr/api/client'
import type { ServerRoutes } from '#server/routes'
import { routeTable } from './routes.gen'

/** Typed, no codegen: route names, params, bodies and outputs come from the server table. */
export const api = createApiClient<ServerRoutes>({
  baseUrl: typeof window === 'undefined' ? 'http://localhost:' + (process.env.PORT ?? 3000) : '',
})
registerRoutes(api, [...routeTable])
`

const files = (ctx: AddContext, name: string) => {
  const brand = displayName(name)
  remove(ctx, 'app/pages/about.tsx', 'app/channels/example.ts')
  addScript(ctx, 'api:sync', 'kitr api:sync')

  write(
    ctx,
    'app/features/chat/schema.ts',
    `import { z } from 'zod'

export const sendMessageSchema = z.object({
  room: z.string().min(1),
  author: z.string().trim().min(1, 'Pick a name').max(32),
  text: z.string().trim().min(1, 'Say something').max(500),
})
export type SendMessage = z.infer<typeof sendMessageSchema>

export const roomQuerySchema = z.object({ room: z.string().default('general') })

export interface Message {
  id: string
  room: string
  author: string
  text: string
  at: string
}
`,
  )

  write(
    ctx,
    'app/channels/chat.ts',
    `import { defineChannel } from 'kitr/realtime'
import type { Message } from '#app/features/chat/schema'

/**
 * One definition for both ends: the server serves it from server/routes.ts and emits \`message\`
 * from MessagesController; the client's \`effects\` refresh the room's query, so the list updates
 * without any wiring in the component. The key is spelled out (\`api.messages.index.key(...)\`
 * would pull the client into the server).
 */
export const chatChannel = defineChannel<{ room: string }>({
  name: 'chat',
  events: {
    message: {
      effects: (_message: Message, { room }) => ({
        invalidate: [['api', 'messages.index', {}, { room }]],
      }),
    },
  },
  authorize: () => true,
})
`,
  )

  write(
    ctx,
    'server/controllers/messages_controller.ts',
    `import type { HttpContext } from 'kitr/api'
import { chatChannel } from '#app/channels/chat'
import {
  type Message,
  type SendMessage,
  roomQuerySchema,
  sendMessageSchema,
} from '#app/features/chat/schema'
import type { z } from 'zod'

type Ctx<Q = Record<string, string | string[]>, B = unknown> = HttpContext<Record<string, string>, Q, B>

/** Last 100 messages per room, in memory. */
const rooms = new Map<string, Message[]>()
const history = (room: string) => {
  let list = rooms.get(room)
  if (!list) {
    list = [
      {
        id: 'welcome',
        room,
        author: 'kitr',
        text: 'Welcome to #' + room + '. Messages here go over a typed WebSocket channel.',
        at: new Date().toISOString(),
      },
    ]
    rooms.set(room, list)
  }
  return list
}

export default class MessagesController {
  static validation = {
    index: { query: roomQuerySchema },
    store: { body: sendMessageSchema },
  }

  async index({ query }: Ctx<z.infer<typeof roomQuerySchema>>) {
    return history(query.room)
  }

  async store({ app, body, response }: Ctx<Record<string, string | string[]>, SendMessage>) {
    const message: Message = {
      id: crypto.randomUUID(),
      room: body.room,
      author: body.author,
      text: body.text,
      at: new Date().toISOString(),
    }
    const list = history(body.room)
    list.push(message)
    if (list.length > 100) list.shift()
    // The socket server mounted by \`.ws()\` in server/routes.ts; everyone in the room gets the event.
    app.container.use('realtime').use(chatChannel, { room: body.room }).emit('message', message)
    response.status(201)
    return message
  }
}
`,
  )

  write(
    ctx,
    'server/routes.ts',
    `import { defineRoutes } from 'kitr/app'
import api from 'kitr/api/routes'
import realtime from 'kitr/realtime/routes'
import { chatChannel } from '#app/channels/chat'
import HealthController from '#server/controllers/health_controller'
import MessagesController from '#server/controllers/messages_controller'

/** Endpoints and the chat socket, served by \`createServer({ routes })\` in server/main.ts. */
export const routes = defineRoutes([api, realtime], (root) =>
  root.group('/api', (r) =>
    r
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .resource('messages', MessagesController, { only: ['index', 'store'] })
      // WebSocket upgrades on /api/ws, next to the REST routes.
      .ws('/ws', {
        channels: [chatChannel],
        // authorize: (request) => verify(request.headers.get('authorization')),
      }),
  ),
)

/** Pass to createApiClient<ServerRoutes>() on the client. */
export type ServerRoutes = typeof routes.$types
`,
  )
  write(
    ctx,
    'app/api/routes.gen.ts',
    routeTable([
      ['health', 'GET', '/api/health'],
      ['messages.index', 'GET', '/api/messages'],
      ['messages.store', 'POST', '/api/messages'],
    ]),
  )
  write(ctx, 'app/api/client.ts', apiClient)

  write(
    ctx,
    'config/realtime.ts',
    `import { defineConfig } from 'kitr/realtime'

export default defineConfig({
  path: '/api/ws',
  transport: 'websocket',
})
`,
  )
  write(
    ctx,
    'app/realtime.ts',
    `import { type SocketTransport, createSocketClient } from 'kitr/realtime'
import realtimeConfig from '#config/realtime'

let transport: SocketTransport | undefined

/** One connection per tab, opened on first use (so nothing connects during SSR). */
export function getSocket(): SocketTransport {
  transport ??= createSocketClient({
    url: () => window.location.origin.replace(/^http/, 'ws') + realtimeConfig.path,
  })
  return transport
}
`,
  )

  write(
    ctx,
    'app/features/chat/queries.ts',
    `import { defineMutation, defineQuery, defineSubscription } from 'kitr/query'
import { channel } from 'kitr/realtime'
import { api } from '#app/api/client'
import { chatChannel } from '#app/channels/chat'
import { getSocket } from '#app/realtime'

export const messagesQuery = defineQuery(api.messages.index.query())

export const sendMessage = defineMutation(
  api.messages.store.mutation({
    // The socket event refreshes the list for everyone, including the sender; nothing to do here.
  }),
)

/** Live events for a room; \`useSubscription(chatSubscription(), { room })\` in a client-only component. */
export const chatSubscription = () => defineSubscription(channel(getSocket(), chatChannel).subscription())
`,
  )

  write(
    ctx,
    'app/storage.ts',
    `import { defineStorage } from 'kitr/storage'

/** The display name, remembered between visits. */
export const displayName = defineStorage('chat:name', { default: '' })
`,
  )

  write(
    ctx,
    'app/document.tsx',
    documentModule({
      imports: '',
      head: `    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: '${brand}' },
    ],`,
      body: '      <Outlet />',
    }),
  )

  write(
    ctx,
    'app/routes.ts',
    `import { defineRoutes } from 'kitr/app'
import router from 'kitr/router/routes'
import { ssrRoute } from 'kitr/seo'
import { head, RootDocument } from './document'

const rooms = ['general', 'random', 'help']

/** Every page of the app. \`kitr make:page <path>\` appends to the chain. */
export const routes = defineRoutes([router], (r) =>
  r.root({ head, component: RootDocument }).page('/', {
    validateSearch: (search: Record<string, unknown>) => ({
      room: typeof search.room === 'string' && rooms.includes(search.room) ? search.room : 'general',
    }),
    // The socket only exists in the browser, so this page renders on the client.
    ...ssrRoute(false),
    lazy: () => import('./pages/chat'),
  }),
)

export type AppRoutes = typeof routes.$types
`,
  )

  write(
    ctx,
    'app/pages/chat.tsx',
    `import { useKitrMutation, useSubscription, useSuspenseQuery } from 'kitr/query'
import { getRouteApi } from 'kitr/router'
import { useStorage } from 'kitr/storage/react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { chatSubscription, messagesQuery, sendMessage } from '#app/features/chat/queries'
import { displayName } from '#app/storage'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#components/ui/card'
import { Input } from '#components/ui/input'

const rooms = ['general', 'random', 'help']
const route = getRouteApi('/')

export default function ChatPage() {
  const { room } = route.useSearch()
  const navigate = route.useNavigate()
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">${brand}</h1>
        {rooms.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={r === room ? 'default' : 'outline'}
            onClick={() => navigate({ search: { room: r } })}
          >
            #{r}
          </Button>
        ))}
      </header>
      <Room key={room} room={room} />
    </main>
  )
}

function Room({ room }: { room: string }) {
  const { data: messages } = useSuspenseQuery(messagesQuery.options({ query: { room } }))
  const subscription = useMemo(() => chatSubscription(), [])
  const live = useSubscription(subscription, { room })
  const send = useKitrMutation(sendMessage)
  const [author, setAuthor] = useStorage(displayName)
  const [text, setText] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when the list grows
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!author.trim() || !text.trim()) return
    await send.mutateAsync({ body: { room, author: author.trim(), text: text.trim() } })
    setText('')
  }

  return (
    <Card className="flex flex-1 flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>#{room}</CardTitle>
        <Badge variant={live.status === 'open' ? 'default' : 'secondary'}>
          {live.status === 'open' ? 'live' : live.status}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <ol className="flex max-h-[60vh] flex-1 flex-col gap-2 overflow-y-auto text-sm">
          {messages.map((message) => (
            <li key={message.id} className="rounded-md bg-muted/50 px-3 py-2">
              <span className="font-medium">{message.author}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {new Date(message.at).toLocaleTimeString()}
              </span>
              <p className="mt-0.5 whitespace-pre-wrap">{message.text}</p>
            </li>
          ))}
          <div ref={bottom} />
        </ol>
        <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
          <Input
            aria-label="Your name"
            placeholder="Your name"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <Input
            aria-label="Message"
            placeholder={'Message #' + room}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" disabled={send.isPending || !author.trim() || !text.trim()}>
            Send
          </Button>
        </form>
        {send.error ? <p className="text-sm text-destructive">{send.error.message}</p> : null}
      </CardContent>
    </Card>
  )
}
`,
  )

  write(
    ctx,
    'test/messages.test.ts',
    `// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { server } from '#server/main'

describe('messages', () => {
  it('stores a message and lists it for the room', async () => {
    const post = await server.fetch(
      new Request('http://app/api/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room: 'tests', author: 'vitest', text: 'hello' }),
      }),
    )
    expect(post.status).toBe(201)
    const list = await server.fetch(new Request('http://app/api/messages?room=tests'))
    const messages = (await list.json()) as Array<{ text: string }>
    expect(messages.at(-1)?.text).toBe('hello')
  })

  it('rejects empty messages', async () => {
    const res = await server.fetch(
      new Request('http://app/api/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room: 'tests', author: 'vitest', text: '  ' }),
      }),
    )
    expect(res.status).toBe(422)
  })
})
`,
  )
}

/**
 * `kitr new --kit realtime`: A chat room: typed WebSocket channels that feed the query cache, a messages controller, rooms in the URL.
 */
export default definePackage({
  name: 'realtime',
  kind: 'kit',
  kit: {
    description:
      'A chat room: typed WebSocket channels that feed the query cache, a messages controller, rooms in the URL.',
    platforms: {
      site: {
        type: 'web',
        options: {
          mode: 'ssr',
        },
      },
      api: {
        type: 'server',
      },
    },
    packages: [
      'query',
      'forms',
      'tailwind',
      'theme',
      'storage',
      'testing',
      'devtools',
      'seo',
      'api',
      'realtime',
    ],
    components: ['button', 'input', 'label', 'card', 'badge', 'page-header'],
    files,
  },
})
