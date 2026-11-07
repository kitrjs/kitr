import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { defineCommand } from 'citty'
import { Codemods } from '../codemods'
import { createContext, type ProjectContext } from '../context'

export const DEFAULT_REGISTRY =
  'https://raw.githubusercontent.com/PodkopovP/kitr/main/registry/dist'

interface RegistryItem {
  name: string
  type: string
  dependencies?: string[]
  registryDependencies?: string[]
  files: Array<{ path: string; type: string; target?: string; content: string }>
}

function registryUrl(ctx: ProjectContext, override?: string): string {
  if (override) return override
  if (process.env.KITR_REGISTRY) return process.env.KITR_REGISTRY
  const cfg = ctx.exists('config/ui.ts') ? ctx.read('config/ui.ts') : ''
  return cfg.match(/registry\s*:\s*['"]([^'"]+)['"]/)?.[1] ?? DEFAULT_REGISTRY
}

async function fetchItem(base: string, name: string): Promise<RegistryItem> {
  if (!/^https?:/.test(base)) {
    const file = resolve(isAbsolute(base) ? base : resolve(process.cwd(), base), `${name}.json`)
    if (!existsSync(file)) throw new Error(`Component "${name}" not found in ${base}`)
    return JSON.parse(readFileSync(file, 'utf8'))
  }
  const res = await fetch(`${base.replace(/\/$/, '')}/${name}.json`)
  if (!res.ok) throw new Error(`Component "${name}" not found at ${base} (${res.status})`)
  return (await res.json()) as RegistryItem
}

/** Copy components (and their registry dependencies) into the app. The code is then owned by the app. */
export async function addComponents(
  ctx: ProjectContext,
  names: string[],
  options: { registry?: string; overwrite?: boolean; install?: boolean } = {},
) {
  const base = registryUrl(ctx, options.registry)
  const componentsDir =
    (ctx.exists('config/ui.ts') &&
      ctx.read('config/ui.ts').match(/componentsDir\s*:\s*['"]([^'"]+)['"]/)?.[1]) ||
    `${ctx.readRc().directories.components}/ui`
  const codemods = new Codemods(ctx)
  const done = new Set<string>()
  const queue = [...names]
  while (queue.length) {
    const name = queue.shift()!
    if (done.has(name)) continue
    done.add(name)
    const item = await fetchItem(base, name)
    for (const dep of item.registryDependencies ?? []) if (!done.has(dep)) queue.push(dep)
    if (item.dependencies?.length) codemods.installPackages(item.dependencies)
    for (const file of item.files) {
      const target =
        file.target ??
        (file.type === 'registry:page'
          ? file.path
          : file.path.replace(/^app\/components\/ui\//, `${componentsDir}/`))
      ctx.write(target, file.content, { overwrite: options.overwrite })
    }
    ctx.log.success(`${name}`)
  }
  await codemods.flush({ install: options.install })
}

export const ui = defineCommand({
  meta: {
    name: 'ui',
    description: 'Manage owned UI components from a shadcn-compatible registry.',
  },
  subCommands: {
    add: defineCommand({
      meta: {
        name: 'add',
        description: 'Copy components into app/components/ui (plus their registry dependencies).',
      },
      args: {
        components: { type: 'positional', required: true },
        registry: { type: 'string', description: 'Registry URL or local directory' },
        overwrite: { type: 'boolean', default: false },
        install: { type: 'boolean', default: true },
      },
      async run({ args, rawArgs }) {
        const ctx = createContext()
        const names = [args.components, ...rawArgs.slice(1).filter((a) => !a.startsWith('-'))]
        await addComponents(ctx, names, {
          registry: args.registry,
          overwrite: args.overwrite,
          install: args.install,
        })
      },
    }),
    list: defineCommand({
      meta: { name: 'list', description: 'List components in the registry.' },
      args: { registry: { type: 'string' } },
      async run({ args }) {
        const ctx = createContext()
        const base = registryUrl(ctx, args.registry)
        const index = /^https?:/.test(base)
          ? await (await fetch(`${base.replace(/\/$/, '')}/registry.json`)).json()
          : JSON.parse(readFileSync(resolve(base, 'registry.json'), 'utf8'))
        for (const item of (
          index as { items: Array<{ name: string; description: string; type: string }> }
        ).items) {
          ctx.log.plain(
            `  ${item.name.padEnd(16)} ${item.description}${item.type === 'registry:page' ? '  (page)' : ''}`,
          )
        }
      },
    }),
  },
})
