import { AsyncLocalStorage } from 'node:async_hooks'
import type { KitrApp } from '@kitr/core'
import type { Logger } from '@kitr/logger'
import type { H3Event } from 'h3'

/**
 * Per-request context. The app is a fork of the server app: same providers
 * and config, its own container instances, so request state never leaks.
 */
export interface RequestContext {
  /** The h3 event for this request. */
  event: H3Event
  /** A fork of the server app with its own container instances. */
  app: KitrApp
  /** The id from the request id header, or a new UUID. */
  requestId: string
  /** A child logger that adds `requestId` to every line. */
  logger: Logger
  /** `performance.now()` when the request arrived, for timing. */
  startedAt: number
  /** Free-form bag for middleware (auth puts `user` here). */
  locals: Record<string, unknown>
  /** The client's IP address, through `trustProxy` proxies. Undefined when the runtime does not say. */
  ip?: string
  /**
   * The Content-Security-Policy nonce for this request, set by `shield` when its policy uses
   * nonces. Inline `<script>` and `<style>` tags in the page carry it; `useCspNonce()` from
   * `kitr/shield` reads it.
   */
  nonce?: string
  /** True when the request is a page the server hands to the app's renderer (`server.fetch(request, { pages })`), not one of the server's own routes. */
  page?: boolean
}

const storage = new AsyncLocalStorage<RequestContext>()

/** Run `fn` with `ctx` as the current request. The server calls it for every request; use it to fake a request in tests. */
export function runWithRequest<T>(ctx: RequestContext, fn: () => T): T {
  publishNonceReader()
  return storage.run(ctx, fn)
}

/**
 * The key client-safe packages (`kitr/router`, `kitr/shield`) read the current request's nonce
 * through. They cannot import this file (it needs `node:async_hooks`), so the server leaves a
 * reader on `globalThis` the first time it runs a request; it stays unset in the browser.
 */
export const REQUEST_NONCE_READER = Symbol.for('kitr.server.requestNonce')

const readNonce = () => storage.getStore()?.nonce

function publishNonceReader() {
  ;(globalThis as unknown as Record<symbol, unknown>)[REQUEST_NONCE_READER] = readNonce
}

/** The current request, from anywhere on the server (services, db hooks, loggers). */
export function useRequest(): RequestContext {
  const ctx = storage.getStore()
  if (!ctx) throw new Error('[kitr/server] useRequest() called outside a request.')
  return ctx
}

/** The current request, or `undefined` outside one. For code that also runs in jobs and scripts. */
export function tryUseRequest(): RequestContext | undefined {
  return storage.getStore()
}

/** The request-scoped app (container fork). Falls back to the given app outside requests. */
export function useRequestApp(fallback?: KitrApp): KitrApp {
  const ctx = storage.getStore()
  if (ctx) return ctx.app
  if (fallback) return fallback
  throw new Error('[kitr/server] useRequestApp() called outside a request and no fallback given.')
}
