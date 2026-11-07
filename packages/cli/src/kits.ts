import type { ProjectContext } from './context'
import { baseReact, baseServer } from './kits-base'
import { presetKits } from './kits-presets'

export type KitName =
  | 'blank'
  | 'app'
  | 'server'
  | 'fullstack'
  | 'saas'
  | 'site'
  | 'realtime'
  | 'desktop'
  | 'mobile'

export interface Kit {
  name: KitName
  description: string
  /** Platforms written to kitrrc.ts (`kitr new --platform` overrides them). */
  platforms?: Record<string, { type: string; options?: Record<string, unknown> }>
  /** Recipes applied after the base files. */
  recipes: string[]
  /** Registry components pulled in (`kitr ui add`). */
  components?: string[]
  base: (ctx: ProjectContext, name: string) => void
  /** Runs after recipes and components: preset pages, controllers, tests. */
  extra?: (ctx: ProjectContext, name: string) => void | Promise<void>
}

const baseKits: Record<'blank' | 'app' | 'server' | 'fullstack', Kit> = {
  blank: {
    name: 'blank',
    description:
      'A web platform with React, TanStack Router and Query, nothing else. Add what you need.',
    platforms: { site: { type: 'web', options: { mode: 'spa' } } },
    recipes: ['query'],
    base: baseReact,
  },
  app: {
    name: 'app',
    description:
      'A logged-in app on an external API: http, forms, tables, state, theme, tailwind, auth, mocks, testing.',
    platforms: { site: { type: 'web', options: { mode: 'spa' } } },
    recipes: [
      'http',
      'forms',
      'table',
      'state',
      'tailwind',
      'theme',
      'auth',
      'storage',
      'mocks',
      'testing',
      'devtools',
    ],
    components: [
      'icon',
      'button',
      'input',
      'label',
      'card',
      'form',
      'data-table',
      'page-header',
      'empty-state',
      'theme-toggle',
      'app-shell',
    ],
    base: baseReact,
  },
  fullstack: {
    name: 'fullstack',
    description:
      'The app kit plus a server-rendered web platform, an API server, actions, api and realtime channels.',
    platforms: { site: { type: 'web', options: { mode: 'ssr' } }, api: { type: 'server' } },
    recipes: [
      'http',
      'forms',
      'table',
      'state',
      'tailwind',
      'theme',
      'auth',
      'storage',
      'testing',
      'devtools',
      'seo',
      'actions',
      'api',
      'realtime',
    ],
    components: [
      'icon',
      'button',
      'input',
      'label',
      'card',
      'form',
      'data-table',
      'page-header',
      'empty-state',
      'theme-toggle',
      'app-shell',
    ],
    base: baseReact,
  },
  server: {
    name: 'server',
    description:
      'A pure backend: h3 server, Adonis-style API, logger, db binding, realtime channels. No React in the bundle.',
    platforms: { api: { type: 'server' } },
    recipes: ['logger', 'api', 'db', 'realtime', 'testing'],
    base: baseServer,
  },
}

export const kits: Record<KitName, Kit> = { ...baseKits, ...presetKits }
