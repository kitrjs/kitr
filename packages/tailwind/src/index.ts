import { createDefineConfig } from '@kitr/core'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** The shadcn `cn()`: clsx plus tailwind-merge, so later classes win. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export interface TailwindConfig {
  /** Entry stylesheet relative to the project root. Default `app/styles/app.css`. */
  entry?: string
  /** Use kitr's preset (`@kitr/tailwind/preset.css`). Default true. */
  preset?: boolean
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    tailwind: TailwindConfig
  }
}

export const defineConfig = createDefineConfig<TailwindConfig>()

export { clsx, twMerge }
