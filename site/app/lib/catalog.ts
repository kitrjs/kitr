import packagesJson from '#app/generated/packages.json'

export type Category =
  | 'data-fetching'
  | 'app-state'
  | 'backend'
  | 'realtime'
  | 'interface'
  | 'forms'
  | 'auth'
  | 'pages'
  | 'dev-tools'

export type RunsOn = 'client' | 'server' | 'both'

export interface PackageEntry {
  name: string
  package: string
  title: string
  summary: string
  category: Category
  runsOn: RunsOn
  builtOn?: string[]
  requires?: string[]
  client?: boolean
  included?: boolean
  version: string
  description: string
  repo: string
  pages: Array<{ slug: string; title: string; order: number }>
  examples: Array<{ slug: string; title?: string; description?: string }>
}

export const packages = packagesJson as PackageEntry[]

export const findPackage = (name: string) => packages.find((p) => p.name === name)

/**
 * Package colours sit outside the three brand fills so the brand stays recognisable and
 * categories can grow. Every one carries dark ink (#0B121C) at 6.8:1 or better.
 */
export const categories: Record<Category, { label: string; color: string }> = {
  'data-fetching': { label: 'Data fetching', color: '#38BDF8' },
  'app-state': { label: 'App state', color: '#A78BFA' },
  backend: { label: 'Backend', color: '#34D399' },
  realtime: { label: 'Real-time', color: '#F472B6' },
  interface: { label: 'Interface', color: '#FB923C' },
  forms: { label: 'Forms', color: '#FACC15' },
  auth: { label: 'Auth', color: '#F87171' },
  pages: { label: 'Pages & routing', color: '#A3E635' },
  'dev-tools': { label: 'Developer tools', color: '#94A3B8' },
}

export const runsOn: Record<RunsOn, { label: string; background: string; icon: string }> = {
  client: { label: 'Client', background: '#BFDBFE', icon: 'M3 4h18v12H3zM8 20h8M12 16v4' },
  server: {
    label: 'Server',
    background: '#FDE68A',
    icon: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
  },
  both: {
    label: 'Client Server',
    background: 'linear-gradient(135deg, #BFDBFE 50%, #FDE68A 50%)',
    icon: 'M3 4h18v12H3zM8 20h8M12 16v4',
  },
}

/** One glyph per package, drawn on a 24px grid with a 1.6 stroke. */
const glyphs: Record<string, string> = {
  query: 'M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M5 4v4h4M19 20v-4h-4',
  http: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  state: 'M4 7l8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4',
  table: 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16',
  db: 'M4 6c0-3 16-3 16 0s-16 3-16 0M4 6v12c0 3 16 3 16 0V6M4 12c0 3 16 3 16 0',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
  api: 'M8 4c-2 0-3 1-3 3v2c0 1-1 3-2 3 1 0 2 2 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1 1 3 2 3-1 0-2 2-2 3v2c0 2-1 3-3 3',
  actions: 'M13 3L5 13h6l-1 8 8-10h-6z',
  ssr: 'M4 5h16v11H4zM9 20h6M12 16v4',
  socket: 'M9 15a4 4 0 1 1 0-6M15 9a4 4 0 1 1 0 6M9 12h6',
  'socket.io':
    'M12 12h.01M8 8a6 6 0 0 0 0 8M16 8a6 6 0 0 1 0 8M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14',
  logger: 'M4 6h16M4 12h10M4 18h13',
  ui: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  forms: 'M3 7h18v10H3zM7 10v4',
  tailwind: 'M3 10c2-4 5-4 7-2s5 2 7-2M7 16c2-4 5-4 7-2s5 2 7-2',
  styling: 'M12 3a9 9 0 0 0 0 18c1 0 2-1 2-2s-1-1-1-2 1-2 2-2h2a4 4 0 0 0 4-4c0-4-4-8-9-8z',
  i18n: 'M4 5h8M8 3v2M6 5c0 4 3 7 6 8M10 5c0 4-3 7-6 8M13 20l4-9 4 9M14.5 17h5',
  auth: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  testing: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3',
  mocks: 'M4 4h4M12 4h4M20 4v4M20 12v4M20 20h-4M12 20H8M4 20v-4M4 12V8',
  router: 'M6 3v18M6 5h11l-2 3 2 3H6',
}
export const glyph = (name: string) => glyphs[name] ?? 'M4 4h16v16H4z'

export const kits = [
  {
    name: 'blank',
    text: 'Router and query. Add the rest as you go.',
    packages: ['router', 'query'],
  },
  {
    name: 'app',
    text: 'A logged-in app on an existing API, with forms, tables and auth.',
    packages: [
      'router',
      'query',
      'http',
      'forms',
      'table',
      'state',
      'ui',
      'auth',
      'mocks',
      'testing',
    ],
  },
  {
    name: 'fullstack',
    text: 'The app kit plus server rendering, server actions, an API and sockets.',
    packages: ['router', 'query', 'forms', 'auth', 'ssr', 'actions', 'api', 'socket'],
  },
  {
    name: 'server',
    text: 'A pure backend with controllers and a typed client. No React.',
    packages: ['server', 'api', 'db', 'logger', 'testing'],
  },
]
