/**
 * Design tokens as plain objects, emitted as CSS custom properties.
 * The same tokens feed `@kitr/tailwind`'s `@theme` block and vanilla CSS alike,
 * so switching styling approach never means re-typing colours.
 */
export type TokenLeaf = string | number
export interface TokenGroup {
  [key: string]: TokenLeaf | TokenGroup
}

export type TokenPath<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends TokenLeaf
    ? `${Prefix}${K}`
    : TokenPath<T[K], `${Prefix}${K}.`>
}[keyof T & string]

export interface DefineTokensResult<T extends TokenGroup> {
  tokens: T
  /** `--kitr-color-primary` style names, typed from the token tree. */
  var: (path: TokenPath<T>) => `var(--${string})`
  name: (path: TokenPath<T>) => `--${string}`
  /** `:root { --kitr-...: ...; }` ready to drop into a stylesheet. */
  css: (selector?: string) => string
  /** Flat `{ '--kitr-color-primary': '#...' }` for inline styles or runtime theming. */
  flat: () => Record<string, string>
}

export function defineTokens<const T extends TokenGroup>(
  tokens: T,
  options: { prefix?: string } = {},
): DefineTokensResult<T> {
  const prefix = options.prefix ?? 'kitr'
  const name = (path: string) => `--${prefix}-${path.replace(/\./g, '-')}` as `--${string}`
  const flat = () => {
    const out: Record<string, string> = {}
    const walk = (group: TokenGroup, trail: string[]) => {
      for (const [key, value] of Object.entries(group)) {
        if (typeof value === 'object') walk(value, [...trail, key])
        else out[name([...trail, key].join('.'))] = String(value)
      }
    }
    walk(tokens, [])
    return out
  }
  return {
    tokens,
    name: (path) => name(path),
    var: (path) => `var(${name(path)})` as `var(--${string})`,
    flat,
    css: (selector = ':root') =>
      `${selector} {\n${Object.entries(flat())
        .map(([k, v]) => `  ${k}: ${v};`)
        .join('\n')}\n}\n`,
  }
}

/** kitr's default tokens. Override any of them in `config/ui.ts`. */
export const defaultTokens = defineTokens({
  color: {
    background: 'oklch(99% 0 0)',
    foreground: 'oklch(20% 0.01 260)',
    muted: 'oklch(96% 0.005 260)',
    mutedForeground: 'oklch(50% 0.02 260)',
    border: 'oklch(90% 0.01 260)',
    primary: 'oklch(55% 0.2 262)',
    primaryForeground: 'oklch(99% 0 0)',
    destructive: 'oklch(55% 0.22 27)',
    destructiveForeground: 'oklch(99% 0 0)',
    ring: 'oklch(55% 0.2 262)',
  },
  radius: { sm: '0.25rem', md: '0.5rem', lg: '0.75rem' },
  font: {
    sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  shadow: { sm: '0 1px 2px oklch(0% 0 0 / 0.06)', md: '0 4px 12px oklch(0% 0 0 / 0.08)' },
})

export const darkTokens = defineTokens({
  color: {
    background: 'oklch(16% 0.01 260)',
    foreground: 'oklch(95% 0.005 260)',
    muted: 'oklch(24% 0.01 260)',
    mutedForeground: 'oklch(70% 0.02 260)',
    border: 'oklch(30% 0.01 260)',
    primary: 'oklch(70% 0.17 262)',
    primaryForeground: 'oklch(16% 0.01 260)',
    destructive: 'oklch(65% 0.2 27)',
    destructiveForeground: 'oklch(16% 0 0)',
    ring: 'oklch(70% 0.17 262)',
  },
})
