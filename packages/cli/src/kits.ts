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
    description: 'TanStack Router + Query, nothing else. Add what you need.',
    recipes: [],
    base: baseReact,
  },
  app: {
    name: 'app',
    description:
      'A logged-in app on an external API: http, forms, tables, state, ui, tailwind, auth, mocks, testing.',
    recipes: [
      'http',
      'forms',
      'table',
      'state',
      'styling',
      'tailwind',
      'ui',
      'auth',
      'storage',
      'mocks',
      'testing',
      'devtools',
    ],
    components: [
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
    description: 'The app kit plus server, ssr, actions, api and sockets on TanStack Start.',
    recipes: [
      'http',
      'forms',
      'table',
      'state',
      'styling',
      'tailwind',
      'ui',
      'auth',
      'storage',
      'testing',
      'devtools',
      'server',
      'ssr',
      'actions',
      'api',
      'socket',
    ],
    components: [
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
      'A pure backend: h3 server, Adonis-style API, logger, db binding, sockets. No React in the bundle.',
    recipes: ['logger', 'server', 'api', 'db', 'socket', 'testing'],
    base: baseServer,
  },
}

export const kits: Record<KitName, Kit> = { ...baseKits, ...presetKits }
