import type { KitrApp } from './app'
import type { DevtoolsPanel, DevtoolsUi } from './devtools'
import type { KitrNode, MaybePromise } from './types'

/**
 * The provider lifecycle, Adonis-style but sized for a browser:
 *
 * - `register`: bind services into the container. Sync, cheap, no I/O.
 * - `boot`: before the first render or first request. Restore sessions, add router context.
 * - `wrap`: return the React tree with your provider around `children` (client apps only).
 * - `ready`: the server is listening (server apps only).
 * - `shutdown`: the server is stopping (server apps only).
 */
export interface KitrProvider {
  /** Unique name, used by `kitr doctor` and error messages. */
  name: string
  register?(app: KitrApp): MaybePromise<void>
  boot?(app: KitrApp): MaybePromise<void>
  wrap?(children: KitrNode, app: KitrApp): KitrNode
  ready?(app: KitrApp): MaybePromise<void>
  shutdown?(app: KitrApp): MaybePromise<void>
  /**
   * Development only: panels for the kitr devtools overlay. Lazy-import the React parts inside.
   * `ui` is `@kitr/devtools/ui`, handed in so a package can build panels without importing the
   * optional `@kitr/devtools` itself.
   */
  devtools?(app: KitrApp, ui: DevtoolsUi): MaybePromise<DevtoolsPanel[]>
}

export type ProviderInput =
  | KitrProvider
  | (() => MaybePromise<KitrProvider | { default: KitrProvider }>)

export function defineProvider(provider: KitrProvider): KitrProvider {
  return provider
}

export async function resolveProvider(input: ProviderInput): Promise<KitrProvider> {
  if (typeof input === 'function') {
    const mod = await input()
    return 'default' in mod && mod.default && !('name' in mod && 'register' in mod)
      ? (mod as { default: KitrProvider }).default
      : (mod as KitrProvider)
  }
  return input
}
