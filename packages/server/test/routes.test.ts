import { type AnyRouteTable, defineRouteExtension, defineRoutes, joinPath } from '@kitr/core'
import { silentLogger } from '@kitr/logger'
import { describe, expect, it } from 'vitest'
import { createServer, type KitrServer } from '../src'

/** A stand-in for `@kitr/api/routes`: `.get(path)` entries, mounted on h3 by the `h3` target. */
const endpoints = defineRouteExtension({
  key: 'endpoints' as never,
  kinds: ['http'],
  methods: {
    get(this: AnyRouteTable, path: string, handler: () => unknown) {
      const fullPath = joinPath(this.prefix, path)
      this.add({ kind: 'http', path: fullPath, name: `GET ${fullPath}`, handler })
      return this
    },
  },
  targets: {
    h3(entries, server: KitrServer) {
      for (const entry of entries)
        server.h3.get(entry.path.replace(/\*$/, '**'), () => (entry.handler as () => unknown)())
      return entries.length
    },
  },
})

/** An extension with no `h3` target: its entries are not the server's to answer. */
const pages = defineRouteExtension({
  key: 'pages' as never,
  kinds: ['page'],
  methods: {
    page(this: AnyRouteTable, path: string) {
      this.add({ kind: 'page', path: joinPath(this.prefix, path), name: `page ${path}` })
      return this
    },
  },
  targets: {},
})

describe('createServer({ routes })', () => {
  const routes = defineRoutes([endpoints, pages], (r: any) =>
    r
      .page('/')
      .page('/projects/$id')
      .group('/api', (api: any) =>
        api
          .get('/health', () => ({ ok: true }))
          .get('/projects/:id', () => ({ id: 1 }))
          .get('/files/*', () => 'file'),
      ),
  )
  const server = createServer({ logger: silentLogger, routes })

  it('mounts the entries of every extension with an h3 target', async () => {
    const res = await server.fetch(new Request('http://x/api/health'))
    expect(await res.json()).toEqual({ ok: true })
    expect((await server.fetch(new Request('http://x/api/projects/7'))).status).toBe(200)
    expect(server.routes).toBe(routes)
  })

  it('tells a Start server entry which paths are its own', () => {
    expect(server.handles(new Request('http://x/api/health'))).toBe(true)
    expect(server.handles('/api/projects/42')).toBe(true)
    expect(server.handles('/api/files/a/b/c.png')).toBe(true)
    expect(server.handles(new URL('http://x/healthz'))).toBe(true)
    // Anything under a segment the table lives in is the server's too, so an unknown endpoint
    // gets its JSON 404 instead of the page renderer's not-found page.
    expect(server.handles('/api')).toBe(true)
    expect(server.handles('/api/projects')).toBe(true)
    expect(server.handles('/api/does-not-exist')).toBe(true)
    // Pages are not the server's, nor are paths under a segment with no route.
    expect(server.handles('/')).toBe(false)
    expect(server.handles('/projects/42')).toBe(false)
    expect(server.handles('/nope/nothing')).toBe(false)
    expect(server.handles('/apis/health')).toBe(false)
  })

  it('answers nothing but the health check without a table', () => {
    const bare = createServer({ logger: silentLogger })
    expect(bare.handles('/healthz')).toBe(true)
    expect(bare.handles('/api/health')).toBe(false)
  })
})
