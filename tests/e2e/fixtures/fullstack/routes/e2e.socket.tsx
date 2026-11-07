import { createFileRoute } from '@tanstack/react-router'
import { channel, createSocketClient } from 'kitr/realtime'
import { useEffect, useState } from 'react'
import { exampleChannel } from '#app/channels/example'

export const Route = createFileRoute('/e2e/socket')({ component: SocketPage })

function SocketPage() {
  const [status, setStatus] = useState('connecting')
  const [messages, setMessages] = useState<Array<{ id: number; text: string }>>([])
  useEffect(() => {
    const transport = createSocketClient({
      url: `${location.origin.replace(/^http/, 'ws')}/api/ws`,
    })
    const offStatus = transport.onStatus(setStatus)
    const off = channel(transport, exampleChannel)
      .subscription()
      .subscribe(
        { room: 'e2e' },
        {
          next: (e) => setMessages((m) => [...m, { id: m.length, text: String(e.data) }]),
          error: (e) => setMessages((m) => [...m, { id: m.length, text: `error:${e.code}` }]),
        },
      )
    return () => {
      off()
      offStatus()
      transport.close()
    }
  }, [])
  return (
    <main>
      <p data-testid="status">{status}</p>
      <ul>
        {messages.map((m) => (
          <li key={m.id}>{m.text}</li>
        ))}
      </ul>
    </main>
  )
}
