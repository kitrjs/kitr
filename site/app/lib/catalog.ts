import {
  Activity01Icon,
  AiMagicIcon,
  Analytics01Icon,
  ApiIcon,
  AppWindowMacIcon,
  AtomicPowerIcon,
  BrowserIcon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  CloudSyncIcon,
  CodeSquareIcon,
  ColorsIcon,
  ComputerPhoneSyncIcon,
  CreditCardIcon,
  CubeIcon,
  DashboardSquare02Icon,
  Database01Icon,
  DatabaseIcon,
  DatabaseSync01Icon,
  Download04Icon,
  FingerPrintIcon,
  Flag02Icon,
  FlashIcon,
  Folder01Icon,
  Globe02Icon,
  HardDriveIcon,
  LanguageSquareIcon,
  LaptopIcon,
  Layers01Icon,
  ListViewIcon,
  LiveStreaming02Icon,
  Mail01Icon,
  MaskIcon,
  Motion02Icon,
  Notification01Icon,
  NotificationSquareIcon,
  Package01Icon,
  PaintBrush01Icon,
  Plug01Icon,
  Route03Icon,
  Search02Icon,
  SearchList01Icon,
  SecurityLockIcon,
  ServerStack02Icon,
  Shield01Icon,
  SmartPhone02Icon,
  SmartPhone03Icon,
  SmartPhone04Icon,
  Table02Icon,
  TailwindcssIcon,
  TestTube01Icon,
  Upload04Icon,
  UserLock01Icon,
  WebDesign01Icon,
  WifiConnected01Icon,
  WifiOff01Icon,
  ZapIcon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import kitsJson from '#app/generated/kits.json'
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
  | 'kits'

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
  examples: Array<{
    slug: string
    title?: string
    description?: string
    storage?: boolean
    height?: number
  }>
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
  kits: { label: 'Kits', color: '#C4B5FD' },
}

/** Packages grouped by category, in the order the categories are listed: how docs navigation walks them. */
export const packageOrder: PackageEntry[] = (Object.keys(categories) as Category[]).flatMap((c) =>
  packages.filter((p) => p.category === c),
)

/** Where a package runs. Badge colours are theme tokens (--client-*, --server-*) in site.css. */
export const runsOn: Record<RunsOn, { label: string }> = {
  client: { label: 'Client' },
  server: { label: 'Server' },
  both: { label: 'Client / Server' },
}

/** One Hugeicon per package, stroke-rounded like the rest of the site. */
const glyphs: Record<string, IconSvgElement> = {
  query: DatabaseSync01Icon,
  http: Globe02Icon,
  state: Layers01Icon,
  table: Table02Icon,
  animation: Motion02Icon,
  '3d': CubeIcon,
  db: Database01Icon,
  server: ServerStack02Icon,
  api: ApiIcon,
  actions: FlashIcon,
  ssr: WebDesign01Icon,
  socket: Plug01Icon,
  'socket.io': WifiConnected01Icon,
  logger: ListViewIcon,
  ui: DashboardSquare02Icon,
  forms: CheckListIcon,
  tailwind: TailwindcssIcon,
  styling: PaintBrush01Icon,
  i18n: LanguageSquareIcon,
  auth: FingerPrintIcon,
  testing: TestTube01Icon,
  mocks: MaskIcon,
  router: Route03Icon,
  analytics: Analytics01Icon,
  monitoring: Activity01Icon,
  pwa: SmartPhone02Icon,
  electron: AtomicPowerIcon,
  tauri: AppWindowMacIcon,
  capacitor: SmartPhone04Icon,
  storage: HardDriveIcon,
  devtools: CodeSquareIcon,
  theme: ColorsIcon,
  platform: ComputerPhoneSyncIcon,
  web: BrowserIcon,
  mobile: SmartPhone04Icon,
  desktop: LaptopIcon,
  seo: SearchList01Icon,
  realtime: LiveStreaming02Icon,
  offline: WifiOff01Icon,
  flags: Flag02Icon,
  'secure-storage': SecurityLockIcon,
  files: Folder01Icon,
  notifications: Notification01Icon,
  native: SmartPhone03Icon,
  updater: Download04Icon,
  cache: ZapIcon,
  shield: Shield01Icon,
  mail: Mail01Icon,
  jobs: Clock01Icon,
  uploads: Upload04Icon,
  consent: CheckmarkCircle02Icon,
  'local-db': DatabaseIcon,
  payments: CreditCardIcon,
  'better-auth': UserLock01Icon,
  ai: AiMagicIcon,
  push: NotificationSquareIcon,
  sync: CloudSyncIcon,
  search: Search02Icon,
}
export const glyph = (name: string): IconSvgElement => glyphs[name] ?? Package01Icon

export interface KitEntry {
  name: string
  text: string
  /** `site: web`, `api: server`. */
  platforms: string[]
  /** Short package names the kit adds. */
  packages: string[]
  components: number
}

/** Generated from the kit packages' setup modules by scripts/content.mjs. */
export const kits = kitsJson as KitEntry[]

/** Shipped packages per category, in catalog order, leaving out categories with none yet. */
export const categoryCounts: Array<{
  category: Category
  label: string
  color: string
  count: number
}> = (Object.keys(categories) as Category[])
  .map((category) => ({
    category,
    ...categories[category],
    count: packages.filter((p) => p.category === category).length,
  }))
  .filter((c) => c.count > 0)
