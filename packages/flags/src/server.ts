import type { KitrApp } from '@kitr/core'
import type { H3Event } from 'h3'
import type { FlagContext, FlagDefinitions, Flags, FlagValues } from './index'

/**
 * Resolve every flag for this request (user from `event.context.kitr.locals.user` when auth ran),
 * cached on the event so loaders, controllers and the page share one answer.
 */
export async function resolveFlags<D extends FlagDefinitions>(
  app: KitrApp,
  event: H3Event | { context: Record<string, any> },
  context: FlagContext = {},
): Promise<FlagValues<D>> {
  const ctx = event.context as Record<string, any>
  if (ctx.kitrFlags) return ctx.kitrFlags
  const user = ctx.kitr?.locals?.user
  // The request's own app (kitr/server forks one per request), so the answer stays with this user.
  const scope: KitrApp = ctx.kitr?.app ?? app
  const flags = scope.container.use('flags') as Flags<D>
  const values = await flags.resolve({ userId: user?.id, ...context })
  ctx.kitrFlags = values
  return values
}

/** The server-resolved snapshot as a script tag the client provider reads before hydration. */
export function flagsScript(values: Record<string, unknown>): string {
  const json = JSON.stringify(values).replace(/</g, '\\u003c')
  return `<script type="application/json" id="__kitr_flags__">${json}</script>`
}

export type { Flags }
