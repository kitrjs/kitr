import { createDefineConfig } from '@kitr/core'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Join class names and drop the Tailwind classes a later one overrides: clsx plus tailwind-merge,
 * as in shadcn. Put a component's `className` prop last so callers can override its defaults.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Options of `config/tailwind.ts`: how the project's stylesheet is set up. The build reads the CSS itself; `kitr doctor` checks the two agree. */
export interface TailwindConfig {
  /** Entry stylesheet relative to the project root. Default `app/styles/app.css`. `kitr doctor` checks it exists and imports Tailwind. */
  entry?: string
  /** Use kitr's preset (`kitr/tailwind/preset.css`). Default true. `kitr doctor` checks the entry imports it exactly when this is on. */
  preset?: boolean
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    tailwind: TailwindConfig
  }
}

/** Types `config/tailwind.ts` against `TailwindConfig` and returns the object unchanged. */
export const defineConfig = createDefineConfig<TailwindConfig>()

/** clsx (join class values) and tailwind-merge's `twMerge` (drop conflicting Tailwind classes), the two halves of `cn()`. */
export { clsx, twMerge }
