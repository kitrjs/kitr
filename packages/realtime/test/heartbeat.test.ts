import { afterEach, describe, expect, it, vi } from 'vitest'

/** A partysocket stand-in: records frames, and lets the test open it and answer. */
const sockets: FakeSocket[] = []
class FakeSocket {
  OPEN = 1
  readyState = 0
  sent: unknown[] = []
  reconnects = 0
  private listeners = new Map<string, Array<(e: unknown) => void>>()
  constructor() {
    sockets.push(this)
  }
  addEventListener(type: string, l: (e: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), l])
  }
  emit(type: string, e: unknown = {}) {
    for (const l of this.listeners.get(type) ?? []) l(e)
  }
  open() {
    this.readyState = 1
    this.emit('open')
  }
  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  reconnect() {
    this.reconnects++
  }
  close() {
    this.readyState = 3
  }
}
vi.mock('partysocket/ws', () => ({ default: FakeSocket }))

const { createSocketClient, createRealtimeClient } = await import('../src')
const pings = (s: FakeSocket) => s.sent.filter((m: any) => m.t === 'ping').length

afterEach(() => {
  sockets.length = 0
  vi.useRealTimers()
})

// `heartbeat` in config/realtime.ts keeps idle sockets alive through proxies and notices
// half-open connections.
describe('websocket heartbeat', () => {
  it('pings on the interval while the server answers', () => {
    vi.useFakeTimers()
    const client = createSocketClient({ url: 'ws://x', heartbeat: 1000 })
    const ws = sockets[0]!
    ws.open()
    vi.advanceTimersByTime(1000)
    expect(pings(ws)).toBe(1)
    ws.emit('message', { data: '{"t":"pong"}' })
    vi.advanceTimersByTime(1000)
    expect(pings(ws)).toBe(2)
    expect(ws.reconnects).toBe(0)
    client.close()
    vi.advanceTimersByTime(5000)
    expect(pings(ws)).toBe(2)
  })

  it('reconnects when a ping goes unanswered', () => {
    vi.useFakeTimers()
    createSocketClient({ url: 'ws://x', heartbeat: 1000 })
    const ws = sockets[0]!
    ws.open()
    vi.advanceTimersByTime(2000)
    expect(ws.reconnects).toBe(1)
  })

  it('does not ping before open, after close, or when disabled', () => {
    vi.useFakeTimers()
    createSocketClient({ url: 'ws://x', heartbeat: 1000 })
    const ws = sockets[0]!
    vi.advanceTimersByTime(3000)
    expect(pings(ws)).toBe(0)
    ws.open()
    ws.emit('close')
    vi.advanceTimersByTime(3000)
    expect(pings(ws)).toBe(0)
    createSocketClient({ url: 'ws://x', heartbeat: 0 })
    sockets[1]!.open()
    vi.advanceTimersByTime(60_000)
    expect(pings(sockets[1]!)).toBe(0)
  })

  it('createRealtimeClient passes heartbeat from config, 25s by default', () => {
    vi.useFakeTimers()
    createRealtimeClient({ url: 'ws://x', heartbeat: 500 })
    createRealtimeClient({ url: 'ws://x' })
    for (const s of sockets) s.open()
    vi.advanceTimersByTime(500)
    expect(pings(sockets[0]!)).toBe(1)
    expect(pings(sockets[1]!)).toBe(0)
    vi.advanceTimersByTime(24_500)
    expect(pings(sockets[1]!)).toBe(1)
  })
})
