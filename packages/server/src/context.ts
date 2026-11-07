import { AsyncLocalStorage } from 'node:async_hooks'
import type { KitrApp } from '@kitr/core'
import type { Logger } from '@kitr/logger'
import type { H3Event } from 'h3'

/**
 * Per-request context. The app is a fork of the server app: same providers
 * and config, its own container instances, so request state never leaks.
 */
export interface RequestContext {
  event: H3Event
  app: KitrApp
  requestId: string
  logger: Logger
  startedAt: number
  /** Free-form bag for middleware (auth puts `user` here). */
  locals: Record<string, unknown>
}

const storage = new AsyncLocalStorage<RequestContext>()

export function runWithRequest<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn)
}

/** The current request, from anywhere on the server (services, db hooks, loggers). */
export function useRequest(): RequestContext {
  const ctx = storage.getStore()
  if (!ctx) throw new Error('[kitr/server] useRequest() called outside a request.')
  return ctx
}

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
