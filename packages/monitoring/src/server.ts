import type { Monitoring } from './index'

/**
 * h3 middleware that reports thrown errors (after the request context exists), then rethrows
 * so kitr's error handler still produces the response. `server.use(reportErrors(monitoring))`.
 */
export function reportErrors(monitoring: Monitoring) {
  return async (
    event: { req: { method: string; url: string }; context?: Record<string, any> },
    next: () => Promise<unknown> | unknown,
  ) => {
    try {
      return await next()
    } catch (error) {
      monitoring.captureException(error, {
        source: 'server',
        extra: {
          method: event.req.method,
          url: event.req.url,
          requestId: event.context?.kitr?.requestId,
        },
      })
      throw error
    }
  }
}
