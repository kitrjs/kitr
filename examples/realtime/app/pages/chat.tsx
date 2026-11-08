import { useMutation, useSubscription, useSuspenseQuery } from '@kitr/query'
import { getRouteApi } from '@kitr/router'
import { useStorage } from '@kitr/storage/react'
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
        <h1 className="mr-auto text-xl font-semibold">Realtime</h1>
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
