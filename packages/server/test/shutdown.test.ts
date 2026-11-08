import { silentLogger } from '@kitr/logger'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer, REQUEST_NONCE_READER, type RequestContext, runWithRequest } from '../src'

afterEach(() => {
  vi.restoreAllMocks()
})

const signalListeners = () => process.listenerCount('SIGINT') + process.listenerCount('SIGTERM')

describe('shutdown signals', () => {
  it('installs one SIGINT/SIGTERM handler for every server in the process and drains them all', async () => {
    const before = signalListeners()
    const a = createServer({ logger: silentLogger, server: { port: 0 } })
    const b = createServer({ logger: silentLogger, server: { port: 0 } })
    const closeA = vi.spyOn(a.app, 'shutdown')
    const closeB = vi.spyOn(b.app, 'shutdown')
    const first = await a.listen({ port: 0, host: '127.0.0.1' })
    const second = await b.listen({ port: 0, host: '127.0.0.1' })
    // One handler for each signal, not one per server.
    expect(signalListeners()).toBe(before + 2)

    const exited = new Promise<void>((resolve) => {
      vi.spyOn(process, 'exit').mockImplementation((() => resolve()) as never)
    })
    process.emit('SIGTERM')
    await exited
    expect(process.exit).toHaveBeenCalledTimes(1)
    expect(process.exit).toHaveBeenCalledWith(0)
    expect(closeA).toHaveBeenCalledTimes(1)
    expect(closeB).toHaveBeenCalledTimes(1)
    // Leave the registry as a real close would, so other tests start clean.
    await Promise.all([first.close(), second.close()])
    expect(signalListeners()).toBe(before)
  })

  it('takes the handler off when the last server closes', async () => {
    const before = signalListeners()
    const a = createServer({ logger: silentLogger })
    const b = createServer({ logger: silentLogger })
    const first = await a.listen({ port: 0, host: '127.0.0.1' })
    const second = await b.listen({ port: 0, host: '127.0.0.1' })
    await first.close()
    expect(signalListeners()).toBe(before + 2)
    await second.close()
    expect(signalListeners()).toBe(before)
  })
})

describe('request nonce reader', () => {
  it('reads the nonce of the request being run, and nothing outside one', () => {
    const ctx = { nonce: 'abc' } as RequestContext
    runWithRequest(ctx, () => undefined)
    const read = (globalThis as unknown as Record<symbol, () => string | undefined>)[
      REQUEST_NONCE_READER
    ]!
    expect(read()).toBeUndefined()
    expect(runWithRequest(ctx, () => read())).toBe('abc')
  })
})

describe('fetch with pages', () => {
  const req = (path: string) => new Request(`http://test${path}`)

  it('hands paths no route answers to the page renderer, inside the middleware', async () => {
    const server = createServer({ logger: silentLogger })
    server.use(async (event, next) => {
      event.res.headers.set('x-seen', 'yes')
      return next()
    })
    server.h3.get('/api/ping', () => ({ pong: true }))
    const pages = vi.fn(
      async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
    )
    const page = await server.fetch(req('/about'), { pages })
    expect(await page.text()).toBe('<html></html>')
    expect(page.headers.get('x-seen')).toBe('yes')
    expect(pages).toHaveBeenCalledTimes(1)
    // Its own routes never reach the renderer.
    expect(await (await server.fetch(req('/api/ping'), { pages })).json()).toEqual({ pong: true })
    expect(pages).toHaveBeenCalledTimes(1)
  })

  it('keeps the JSON 404 without a renderer', async () => {
    const server = createServer({ logger: silentLogger })
    expect((await server.fetch(req('/nothing'))).status).toBe(404)
  })
})
