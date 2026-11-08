import { schemaFrom } from '@kitr/core'
import { H3 } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineChannel } from '../src'
import { createSseTransport } from '../src/sse'
import { createSseServer } from '../src/sse-server'

const project = defineChannel<{ id: string }>({
  name: 'project',
  // The schema trims, so ' prj_1 ' and 'prj_1' are the same topic.
  params: schemaFrom((p: any) =>
    typeof p?.id === 'string' ? { id: p.id.trim() } : { issues: [{ message: 'id', path: ['id'] }] },
  ),
  events: { updated: {} },
})

/** Just enough EventSource over an in-process fetch: named events and `message`. */
function fakeEventSource(fetchImpl: (req: Request) => Promise<Response>) {
  return class {
    static CLOSED = 2
    readyState = 0
    private listeners = new Map<string, Array<(e: { data: string }) => void>>()
    private abort = new AbortController()
    constructor(url: string) {
      void fetchImpl(new Request(url, { signal: this.abort.signal })).then(async (res) => {
        this.readyState = 1
        const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
        let buffer = ''
        for (;;) {
          const { value, done } = await reader.read().catch(() => ({ value: '', done: true }))
          if (done) return
          buffer += value
          let end = buffer.indexOf('\n\n')
          while (end >= 0) {
            const block = buffer.slice(0, end)
            buffer = buffer.slice(end + 2)
            const event = /^event: (.*)$/m.exec(block)?.[1] ?? 'message'
            const data = /^data: (.*)$/m.exec(block)?.[1]
            if (data !== undefined) for (const l of this.listeners.get(event) ?? []) l({ data })
            end = buffer.indexOf('\n\n')
          }
        }
      })
    }
    addEventListener(type: string, listener: (e: { data: string }) => void) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
    }
    close() {
      this.readyState = 2
      this.abort.abort()
    }
  }
}

afterEach(() => vi.unstubAllGlobals())

// The SSE server sends the schema's output params back, so a client that subscribes with
// ' prj_1 ' listens on the topic the server publishes to.
describe('SSE transport', () => {
  it('delivers events to a subscription whose params the schema transformed', async () => {
    const sse = createSseServer({ channels: [project], keepAlive: 60_000 })
    const h3 = new H3()
    h3.get('/events', sse.handler)
    h3.post('/events', sse.handler)
    const local = (req: Request) => Promise.resolve(h3.fetch(req))
    vi.stubGlobal('EventSource', fakeEventSource(local))
    vi.stubGlobal('fetch', (input: RequestInfo, init?: RequestInit) =>
      local(new Request(new URL(String(input), 'http://app.test'), init)),
    )

    const transport = createSseTransport({ url: 'http://app.test/events' })
    await vi.waitFor(() => expect(transport.status).toBe('open'))
    const received: unknown[] = []
    transport.subscribe('project', { id: ' prj_1 ' }, (event, data) => received.push([event, data]))
    await vi.waitFor(() => expect(sse.use(project, { id: 'prj_1' }).size).toBe(1))
    // Give the `ok` reply time to arrive before publishing.
    await new Promise((r) => setTimeout(r, 20))
    sse.use(project, { id: 'prj_1' }).emit('updated', { name: 'Apollo' })
    await vi.waitFor(() => expect(received).toEqual([['updated', { name: 'Apollo' }]]))
    transport.close()
  })
})
