import type { MutationContract, QueryContract } from '@kitr/core'
import { useEffect } from 'react'

/**
 * A map of Rust `#[tauri::command]` functions: argument object → return type.
 * `defineCommands<Commands>()` gives you `commands.greet({ name })` typed end to end.
 */
export type CommandMap = Record<string, (args: any) => unknown>

/** The typed functions `defineCommands<C>()` returns: one per command, taking its argument object and resolving with its result. */
export type Commands<C extends CommandMap> = {
  [K in keyof C]: Parameters<C[K]>[0] extends undefined | void
    ? () => Promise<Awaited<ReturnType<C[K]>>>
    : (args: Parameters<C[K]>[0]) => Promise<Awaited<ReturnType<C[K]>>>
}

/** True inside a Tauri webview (checks `window.__TAURI_INTERNALS__`), false in a browser. */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

/**
 * Typed `invoke`. Command names are the Rust function names (snake_case), argument keys are
 * the Rust parameter names in camelCase, exactly as Tauri expects.
 *
 *   type Commands = { greet: (args: { name: string }) => string }
 *   export const commands = defineCommands<Commands>()
 *   await commands.greet({ name: 'kitr' })
 */
export function defineCommands<C extends CommandMap>(): Commands<C> {
  return new Proxy({} as Commands<C>, {
    get: (_, cmd) =>
      // `then`/`toJSON` are probed by await and JSON.stringify; they are never commands.
      typeof cmd !== 'string' || cmd === 'then' || cmd === 'toJSON'
        ? undefined
        : (args?: Record<string, unknown>) => tauriInvoke(cmd, args),
  })
}

/** A query contract over a command, for `queryFrom(commandQuery(commands.greet, 'greet'))`. */
export function commandQuery<TInput, TOutput>(
  command: (args: TInput) => Promise<TOutput>,
  name: string,
): Omit<QueryContract<TInput, TOutput>, 'kind'> {
  return {
    key: (input) => ['tauri', name, input as unknown],
    fetch: (input) => command(input),
    source: 'tauri',
  }
}

/**
 * A mutation contract over a command, for `mutationFrom(commandMutation(commands.ship_order, { effects }))`.
 * `effects` say which cached queries to set, invalidate or remove when the command succeeds.
 */
export function commandMutation<TInput, TOutput>(
  command: (args: TInput) => Promise<TOutput>,
  options: { effects?: MutationContract<TInput, TOutput>['effects'] } = {},
): Omit<MutationContract<TInput, TOutput>, 'kind'> {
  return { mutate: (input) => command(input), effects: options.effects, source: 'tauri' }
}

/** Subscribe to a Tauri event (`app.emit("progress", payload)` on the Rust side). */
export function useTauriEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | undefined
    let cancelled = false
    import('@tauri-apps/api/event').then(async ({ listen }) => {
      const stop = await listen<T>(event, (e) => handler(e.payload))
      if (cancelled) stop()
      else unlisten = stop
    })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [event, handler])
}

/** Emit to the Rust side or other windows. No-op in a browser. */
export async function emitTauri<T>(event: string, payload?: T) {
  if (!isTauri()) return
  const { emit } = await import('@tauri-apps/api/event')
  await emit(event, payload)
}
