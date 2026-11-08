import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

/**
 * Tailwind v4 for kitr apps. Exactly `@tailwindcss/vite`, exposed here so
 * `kitr add tailwind` has one import to write and one version to manage.
 */
export function kitrTailwind(): Plugin[] {
  return tailwindcss() as Plugin[]
}

export default kitrTailwind
