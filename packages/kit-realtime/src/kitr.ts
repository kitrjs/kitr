import {
  type AddContext,
  definePackage,
  displayName,
  removeFiles as remove,
  startRoot,
  writeTemplate as write,
} from '@kitr/core/package'

const routeTable = (routes: Array<[name: string, method: string, path: string]>) =>
  `// Route table for the typed client. Regenerate with \`kitr api:sync\`.\nexport const routeTable = ${JSON.stringify(
    routes.map(([name, method, path]) => ({ name, method, path })),
    null,
    2,
  )} as const\n`

const apiClient = `import { createApiClient, registerRoutes } from 'kitr/api/client'
import type { AppRoutes } from '#server/routes'
import { routeTable } from './routes.gen'

/** Typed, no codegen: route names, params, bodies and outputs come from the router. */
export const api = createApiClient<AppRoutes>({
  baseUrl: typeof window === 'undefined' ? 'http://localhost:' + (process.env.PORT ?? 3000) : '',
})
registerRoutes(api, [...routeTable])
`

const files = (ctx: AddContext, name: string) => {
  const brand = displayName(name)
  remove(ctx, 'app/routes/about.tsx', 'app/channels/example.ts')
  ctx.scripts.add('api:sync', 'kitr api:sync')

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
import { api } from '#app/api/client'
import type { Message } from '#app/features/chat/schema'

/**
 * One definition for both ends. The server emits \`message\` from MessagesController;
 * the client's \`effects\` refresh the room's query, so the list updates without any wiring in the component.
 */
export const chatChannel = defineChannel<{ room: string }>({
  name: 'chat',
  events: {
    message: {
      effects: (_message: Message, { room }) => ({
        invalidate: [api.messages.index.key({ query: { room } })],
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
import { realtime } from '#server/realtime'
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

  async store({ body, response }: Ctx<Record<string, string | string[]>, SendMessage>) {
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
    realtime.use(chatChannel, { room: body.room }).emit('message', message)
    response.status(201)
    return message
  }
}
`,
  )

  write(
    ctx,
    'server/routes.ts',
    `import { defineRoutes } from 'kitr/api'
import HealthController from '#server/controllers/health_controller'
import MessagesController from '#server/controllers/messages_controller'

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api' }, (api) =>
    api
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .resource('messages', MessagesController, { only: ['index', 'store'] }),
  ),
)

/** Pass to createApiClient<AppRoutes>() on the client. */
export type AppRoutes = typeof routes.$types
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
    'server/realtime.ts',
    `import { createRealtimeServer } from 'kitr/realtime/server'
import { chatChannel } from '#app/channels/chat'

export const realtime = createRealtimeServer({
  channels: [chatChannel],
  // authorize: (request) => verify(request.headers.get('authorization')),
})
`,
  )
  write(
    ctx,
    'server/main.ts',
    `import { mountRoutes } from 'kitr/api'
import { createServer } from 'kitr/server'
import { config } from '../config'
import rc from '../kitrrc'
import { routes } from '#server/routes'
import { realtime } from '#server/realtime'

/** The kitr server behind Start's /api/* catch-all route; also what tests call. Providers from kitrrc.ts, config from config/. */
export const server = createServer({ providers: rc.providers, config })
mountRoutes(server, routes)
// WebSocket upgrades on /api/ws, next to the REST routes.
realtime.attach(server, '/api/ws')
`,
  )
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
    `import { mutationFrom, queryFrom, subscriptionFrom } from 'kitr/query'
import { channel } from 'kitr/realtime'
import { api } from '#app/api/client'
import { chatChannel } from '#app/channels/chat'
import { getSocket } from '#app/realtime'

export const messagesQuery = queryFrom(api.messages.index.query())

export const sendMessage = mutationFrom(
  api.messages.store.mutation({
    // The socket event refreshes the list for everyone, including the sender; nothing to do here.
  }),
)

/** Live events for a room; \`useSubscription(chatSubscription(), { room })\` in a client-only component. */
export const chatSubscription = () => subscriptionFrom(channel(getSocket(), chatChannel).subscription())
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
    'app/routes/__root.tsx',
    startRoot({
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
    'app/routes/index.tsx',
    `import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useSubscription, useSuspenseQuery } from 'kitr/query'
import { ssrRoute } from 'kitr/seo'
import { useStorage } from 'kitr/storage/react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { chatSubscription, messagesQuery, sendMessage } from '#app/features/chat/queries'
import { displayName } from '#app/storage'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#components/ui/card'
import { Input } from '#components/ui/input'

const rooms = ['general', 'random', 'help']

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    room: typeof search.room === 'string' && rooms.includes(search.room) ? search.room : 'general',
  }),
  // The socket only exists in the browser, so this page renders on the client.
  ...ssrRoute(false),
  component: ChatPage,
})

function ChatPage() {
  const { room } = Route.useSearch()
  const navigate = Route.useNavigate()
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
  const send = useMutation(sendMessage)
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
      'seo',
      'api',
      'realtime',
    ],
    components: ['button', 'input', 'label', 'card', 'badge', 'page-header'],
    files,
  },
})
