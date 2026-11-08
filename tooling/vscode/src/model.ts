/**
 * The sidebar trees as plain data. Pure: file lookups come in as a function, so the model is
 * unit-tested without VS Code; `views.ts` turns each node into a TreeItem.
 */
import type { ApiRoute, GeneratorRow, KitrInfo, PlatformRow } from './cli'
import { controllerCandidates, moduleCandidates, type RouteEntry } from './routes'

export interface TreeNode {
  id: string
  label: string
  description?: string
  tooltip?: string
  /** A codicon id: `file`, `server`, `play`. */
  icon?: string
  /** Drives the context menus in package.json (`platform`, `generator`). */
  contextValue?: string
  /** Project-relative file to open on click. */
  open?: string
  /** 0-based line to reveal in `open`. */
  line?: number
  /** A command to run on click instead of opening a file. */
  command?: { command: string; arguments: unknown[] }
  children?: TreeNode[]
  expanded?: boolean
}

/** Returns the first of the candidate project-relative paths that exists. */
export type FindFile = (candidates: string[]) => string | undefined

const platformIcons: Record<string, string> = {
  web: 'globe',
  server: 'server',
  desktop: 'device-desktop',
  tauri: 'window',
  mobile: 'device-mobile',
}

/** The options worth a glance in the tree, in this order. */
const keyOptions = ['mode', 'runtime', 'port', 'targets', 'pwa', 'title']

export function platformNodes(info: KitrInfo, resolved: PlatformRow[] = []): TreeNode[] {
  return Object.entries(info.platforms).map(([name, spec]) => {
    const row = resolved.find((r) => r.name === name)
    const options: Record<string, string> = { ...row?.options }
    for (const [k, v] of Object.entries(spec.options ?? {}))
      options[k] ??= typeof v === 'string' ? v : JSON.stringify(v)
    const shown = keyOptions.filter((k) => options[k] !== undefined && options[k] !== 'false')
    const type = row?.type ?? spec.factory
    return {
      id: `platform:${name}`,
      label: name,
      description: [type, ...shown.map((k) => `${k}=${options[k]}`)].join(' · '),
      tooltip: [
        `${name}: ${type}${spec.source ? ` (${spec.source})` : ''}`,
        ...Object.entries(options).map(([k, v]) => `${k} = ${v}`),
        '',
        `kitr dev ${name} · kitr build ${name} · kitr start ${name}`,
      ].join('\n'),
      icon: platformIcons[type] ?? 'symbol-namespace',
      contextValue: 'platform',
      open: 'kitrrc.ts',
    }
  })
}

export function packageNodes(info: KitrInfo, find: FindFile): TreeNode[] {
  const config = info.directories.config ?? 'config'
  const nodes: TreeNode[] = info.packages.map((pkg) => {
    const short = pkg.startsWith('@kitr/') ? pkg.slice('@kitr/'.length) : pkg.replace(/^@/, '')
    const file = find([`${config}/${short}.ts`, `${config}/${short}.tsx`])
    return {
      id: `package:${pkg}`,
      label: short,
      description: file ?? pkg,
      tooltip: file ? `${pkg}: ${file}` : `${pkg} (no config file)`,
      icon: file ? 'gear' : 'package',
      contextValue: 'package',
      open: file,
    }
  })
  nodes.push({
    id: 'package:add',
    label: 'Add package…',
    icon: 'add',
    command: { command: 'kitr.addPackage', arguments: [] },
  })
  return nodes
}

export function providerNodes(info: KitrInfo, rcSource = ''): TreeNode[] {
  // Search from `providers:` on, so a package listed in `packages: [...]` with the same
  // specifier (`@kitr/logger`) does not win.
  const from = Math.max(0, rcSource.search(/\bproviders\s*:/))
  return info.providers.map((spec) => {
    const at =
      [`'${spec}'`, `"${spec}"`]
        .map((q) => rcSource.indexOf(q, from))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b)[0] ?? -1
    return {
      id: `provider:${spec}`,
      label: spec,
      icon: 'plug',
      contextValue: 'provider',
      open: 'kitrrc.ts',
      line: at < 0 ? undefined : rcSource.slice(0, at).split('\n').length - 1,
    }
  })
}

export function routeNodes(options: {
  pages: RouteEntry[]
  api?: ApiRoute[]
  /** The folder of the routes file, `app`. */
  appDir: string
  serverDir?: string
  find: FindFile
  /** The routes file itself, for entries without a module file. */
  routesFile?: string
}): TreeNode[] {
  const { appDir, find } = options
  const routesFile = options.routesFile ?? `${appDir}/routes.ts`
  const page = (e: RouteEntry, at: string): TreeNode => {
    const file = find(moduleCandidates(e, appDir))
    const children = e.children.map((c, i) => page(c, `${at}.${i}`))
    const label = e.kind === 'page' ? (e.path ?? e.label) : e.label
    return {
      id: `route:${at}:${e.kind}:${e.label}`,
      label,
      description: e.kind === 'page' ? file : e.kind,
      tooltip: `${e.kind} ${e.label}${file ? `\n${file}` : ''}\n${routesFile}:${e.line + 1}`,
      icon: e.kind === 'page' ? 'file' : e.kind === 'layout' ? 'layout' : 'folder',
      contextValue: `route-${e.kind}`,
      open: file ?? routesFile,
      line: file ? undefined : e.line,
      children: children.length ? children : undefined,
      expanded: true,
    }
  }
  const out: TreeNode[] = []
  if (options.pages.length)
    out.push({
      id: 'routes:pages',
      label: 'Pages',
      icon: 'browser',
      open: routesFile,
      children: options.pages.map((e, i) => page(e, String(i))),
      expanded: true,
    })
  if (options.api?.length)
    out.push({
      id: 'routes:api',
      label: 'API',
      icon: 'symbol-interface',
      children: options.api.map((r, i) => {
        const controller = find(controllerCandidates(r.name, options.serverDir))
        return {
          id: `api:${i}:${r.verb}:${r.path}`,
          label: `${r.verb} ${r.path}`,
          description: r.name,
          tooltip: controller ? `${r.name}\n${controller}` : r.name,
          icon: r.verb === 'WS' || r.verb === 'SSE' ? 'radio-tower' : 'arrow-swap',
          contextValue: 'route-api',
          open: controller ?? find([`${options.serverDir ?? 'server'}/routes.ts`]),
        }
      }),
      expanded: true,
    })
  return out
}

export function generatorNodes(rows: GeneratorRow[]): TreeNode[] {
  return rows.map((r) => ({
    id: `generator:${r.kind}`,
    label: `make:${r.kind}`,
    description: r.pattern,
    tooltip: `${r.definition ?? r.description}\n${r.owner}`,
    icon: 'new-file',
    contextValue: 'generator',
    command: { command: 'kitr.make', arguments: [r.kind] },
  }))
}
