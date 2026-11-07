/**
 * Helpers for plain CSS and CSS Modules. No runtime cost beyond string joins.
 */

/** Type a CSS Modules import so `styles.foo` is checked. Generate the `.d.ts` with `kitr css:types`. */
export type CssModule<K extends string> = { readonly [P in K]: string }

/** Pick classes from a module with optional conditions: `pick(styles, 'card', { active })`. */
export function pick<K extends string>(
  styles: CssModule<K>,
  ...parts: Array<K | Partial<Record<K, boolean | undefined>> | false | null | undefined>
): string {
  const out: string[] = []
  for (const part of parts) {
    if (!part) continue
    if (typeof part === 'string') out.push(styles[part])
    else for (const [key, on] of Object.entries(part)) if (on) out.push(styles[key as K])
  }
  return out.join(' ')
}

/** Build a `style` object from CSS variables: `vars({ '--gap': '8px' })`. */
export function vars(values: Record<`--${string}`, string | number>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(values)) out[k] = String(v)
  return out
}

/** Data-attribute variants for vanilla CSS: `<div {...dataAttrs({ state, size })}>` → `data-state="open"`. */
export function dataAttrs(values: Record<string, string | number | boolean | null | undefined>) {
  const out: Record<`data-${string}`, string> = {}
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === null || v === false) continue
    out[`data-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`] = v === true ? '' : String(v)
  }
  return out
}
