import packagesJson from '#app/generated/packages.json'
import plannedJson from '#app/generated/planned.json'

export type Category =
  | 'data-fetching'
  | 'app-state'
  | 'backend'
  | 'realtime'
  | 'interface'
  | 'forms'
  | 'auth'
  | 'pages'
  | 'platforms'
  | 'device'
  | 'insights'
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

export type PlannedStatus = 'building' | 'next' | 'later'

/** A package from the package map that has not shipped yet. */
export interface PlannedEntry {
  name: string
  status: PlannedStatus
  summary: string
  category: Category
  runsOn: RunsOn
  builtOn?: string[]
  replaces?: string[]
}

export const planned = plannedJson as PlannedEntry[]

export const plannedStatus: Record<
  PlannedStatus,
  { label: string; heading: string; text: string }
> = {
  building: {
    label: 'In progress',
    heading: 'Being built now',
    text: 'Part of the current release. Some replace a package above, which keeps working until then.',
  },
  next: {
    label: 'Next',
    heading: 'Coming next',
    text: 'Designed and scheduled for the release after this one.',
  },
  later: {
    label: 'Roadmap',
    heading: 'On the roadmap',
    text: 'Ideas we intend to build. Nothing here exists yet, and the details may change.',
  },
}

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
  platforms: { label: 'Platforms', color: '#2DD4BF' },
  device: { label: 'Device features', color: '#E879F9' },
  insights: { label: 'Analytics & errors', color: '#E0B872' },
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
  analytics: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  monitoring: 'M3 12h4l3-7 4 14 3-7h4',
  pwa: 'M7 3h10v18H7zM11 18h2M12 7v6M9 10l3 3 3-3',
  electron:
    'M12 12h.01M12 3c5 0 5 18 0 18S7 3 12 3M4 7.5c2.5-4.3 18 4.7 15.5 9S1.5 11.8 4 7.5M20 7.5c2.5 4.3-13 13.3-15.5 9S17.5 3.2 20 7.5',
  tauri: 'M4 9a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 15a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
  capacitor: 'M7 3h10v18H7zM11 18h2',
  storage: 'M5 4h14v16H5zM5 9h14M5 14h14M9 6.5h.01M9 11.5h.01M9 16.5h.01',
  devtools: 'M8 9l-4 3 4 3M16 9l4 3-4 3M14 5l-4 14',
  theme: 'M12 3a9 9 0 1 0 0 18zM12 3a9 9 0 0 1 0 18',
  platform: 'M3 5h12v10H3zM17 9h4v10h-4zM6 19h6',
  web: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  mobile: 'M7 3h10v18H7zM11 18h2',
  desktop: 'M3 4h18v12H3zM8 20h8M12 16v4',
  seo: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-4-4',
  realtime: 'M9 15a4 4 0 1 1 0-6M15 9a4 4 0 1 1 0 6M9 12h6',
  offline:
    'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5-2.7M14.5 9.8a10 10 0 0 1 4.5 2.7M12 20h.01',
  flags: 'M5 21V4M5 4h12l-2 4 2 4H5',
  'secure-storage': 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  files: 'M6 3h8l4 4v14H6zM14 3v4h4',
  notifications: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  native: 'M7 3h10v18H7zM10 8l4 4-4 4',
  updater: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  cache: 'M13 3L5 13h6l-1 8 8-10h-6zM3 21h18',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  jobs: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 3',
  uploads: 'M12 20V8M7 13l5-5 5 5M5 4h14',
  consent: 'M4 12l5 5L20 6',
  'local-db': 'M4 6c0-3 16-3 16 0s-16 3-16 0M4 6v12c0 3 16 3 16 0V6M4 12c0 3 16 3 16 0',
  payments: 'M3 6h18v12H3zM3 10h18M7 15h4',
  'better-auth': 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  ai: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 15l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z',
  push: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4M19 3l2 2-2 2',
  sync: 'M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M5 4v4h4M19 20v-4h-4',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-4-4',
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
