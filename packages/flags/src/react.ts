import { useApp } from '@kitr/react'
import { createElement, useSyncExternalStore } from 'react'
import { FLAGS_SCRIPT_ID, type FlagDefinitions, type Flags, type FlagValues } from './index'

function useFlagsStore<D extends FlagDefinitions>(): Flags<D> {
  const app = useApp()
  return app.container.use('flags') as Flags<D>
}

/** One flag's value; re-renders when a resolve or hydrate changes it. */
export function useFlag<D extends FlagDefinitions, K extends keyof D & string>(
  key: K,
): D[K]['default'] {
  const flags = useFlagsStore<D>()
  return useSyncExternalStore(
    flags.subscribe,
    () => flags.value(key),
    () => flags.value(key),
  )
}

/** Every flag, as a plain object. */
export function useFlags<D extends FlagDefinitions = FlagDefinitions>(): FlagValues<D> {
  const flags = useFlagsStore<D>()
  return useSyncExternalStore(
    flags.subscribe,
    () => flags.snapshot(),
    () => flags.snapshot(),
  )
}

/** Put in the document head of the root route with the values `resolveFlags()` returned in the loader. */
export function FlagsScript({ values }: { values: Record<string, unknown> }) {
  return createElement('script', {
    type: 'application/json',
    id: FLAGS_SCRIPT_ID,
    // JSON with `<` escaped, not markup: the only way to embed data in a script element.
    // biome-ignore lint/security/noDangerouslySetInnerHtml: escaped JSON payload
    dangerouslySetInnerHTML: { __html: JSON.stringify(values).replace(/</g, '\\u003c') },
  })
}
