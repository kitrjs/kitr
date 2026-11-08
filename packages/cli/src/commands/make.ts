import { existsSync } from 'node:fs'
import {
  type Generator,
  type GeneratorVars,
  generatorFile,
  naming,
  type ProjectInfo,
} from '@kitr/core/package'
import { type CommandDef, defineCommand } from 'citty'
import pc from 'picocolors'
import { createAddContext, createProjectInfo } from '../add-context'
import { Codemods } from '../codemods'
import { createContext } from '../context'
import { installedPackages } from '../packages'

export type StubFn = (vars: GeneratorVars) => string

/**
 * `kitr make:<kind>`. The core ships the three generators that need no package (a provider, a
 * service, an exception); every other generator comes from the package that owns the code it
 * writes (`make:page` from router, `make:job` from jobs...). Every kind has one home and one file
 * name pattern (kebab-case, a suffix exactly when the export carries one), and nested names put
 * the file in a feature folder inside that home: `make:service billing/usage` writes
 * `server/services/billing/usage-service.ts`. `kitr make` lists them all. A project overrides any
 * stub with `kitr eject stub <kind>`, which copies it to `stubs/<kind>.ts`.
 */
// kitr-allow-module-state: lookup table built once at import, never mutated
export const coreGenerators: Record<string, Generator> = {
  provider: {
    description: 'Create a kitr provider in app/providers and list it in kitrrc.ts',
    definition: 'A lifecycle object: register container bindings, boot, and wrap the React tree.',
    target: (name, project) =>
      generatorFile(project, 'app', 'providers', name, { suffix: '-provider' }),
    stub: ({ name }) => `import { defineProvider } from 'kitr/app'

export default defineProvider({
  name: '${naming.snake(name)}',
  register(app) {
    // app.container.singleton('${naming.camel(name)}', () => new ${naming.pascal(name)}Service())
    void app
  },
  async boot(app) {
    void app
  },
  // wrap: (children) => <${naming.pascal(name)}Context.Provider>{children}</${naming.pascal(name)}Context.Provider>,
})
`,
    // A provider nobody lists never runs: add it to kitrrc.ts through the #app alias, which
    // the Vite plugin and Node subpath imports both resolve.
    after(ctx, { file }) {
      const appDir = ctx.rc.directories.app ?? 'app'
      const module = file.replace(/\.tsx?$/, '')
      ctx.provider.add(
        module.startsWith(`${appDir}/`) ? `#app/${module.slice(appDir.length + 1)}` : `./${module}`,
      )
      ctx.log.step(`${ctx.dryRun ? 'would list' : 'listed'} ${file} in kitrrc.ts providers`)
    },
  },
  service: {
    description: 'Create a service class in server/services',
    definition: 'A plain class holding business logic, bound in the container by a provider.',
    target: (name, project) =>
      generatorFile(project, 'server', 'services', name, { suffix: '-service' }),
    stub: ({ name }) => `import type { KitrApp } from 'kitr/app'

/**
 * Plain class with the business logic for ${naming.snake(name)}; bind it in a provider:
 *   app.container.singleton('${naming.camel(name)}', () => new ${naming.pascal(name)}Service(app))
 */
export class ${naming.pascal(name)}Service {
  constructor(private readonly app: KitrApp) {}

  async list() {
    void this.app
    return []
  }
}

// Augment @kitr/core itself: kitr/app only re-exports it, so augmenting kitr/app types nothing.
declare module '@kitr/core' {
  interface ContainerBindings {
    ${naming.camel(name)}: ${naming.pascal(name)}Service
  }
}
`,
  },
  exception: {
    description: 'Create a typed error class in app/exceptions',
    definition: 'A KitrError subclass with a code, turned into a typed error on every transport.',
    target: (name, project) =>
      generatorFile(project, 'app', 'exceptions', name, { suffix: '-error' }),
    stub: ({ name }) => `import { KitrError } from 'kitr/app'

/**
 * Thrown from actions and controllers; the API layer turns it into a JSON error with the
 * right status and the client gets a typed \`KitrError\` back.
 */
export class ${naming.pascal(name)}Error extends KitrError {
  constructor(message = '${naming.pascal(name)}', data?: unknown) {
    super('BAD_REQUEST', message, { data })
    this.name = '${naming.pascal(name)}Error'
  }
}
`,
  },
}

/** The project's `stubs/<kind>.ts` overrides, each a default-exported stub function. */
export async function stubOverrides(root: string): Promise<Record<string, StubFn>> {
  const out: Record<string, StubFn> = {}
  const dir = `${root}/stubs`
  if (!existsSync(dir)) return out
  const { readdirSync } = await import('node:fs')
  const { createJiti } = await import('jiti')
  const jiti = createJiti(import.meta.url)
  for (const file of readdirSync(dir)) {
    if (!/\.(ts|js|mjs|mts)$/.test(file)) continue
    const mod = (await jiti.import(`${dir}/${file}`)) as { default?: StubFn }
    if (typeof mod.default === 'function') out[file.replace(/\.\w+$/, '')] = mod.default
  }
  return out
}

/** Render a generator's stub for `name`, through the project's override when it has one. */
export function renderStub(
  kind: string,
  generator: Generator,
  vars: GeneratorVars,
  overrides: Record<string, StubFn> = {},
): string {
  return (overrides[kind] ?? generator.stub)(vars)
}

/** `make:<kind>` for one generator. `owner` names the package it comes from, for `--help`. */
export function generatorCommand(
  kind: string,
  generator: Generator,
  owner?: string,
): CommandDef<any> {
  const extra = Object.fromEntries(
    Object.entries(generator.args ?? {}).map(([k, a]) => [
      k,
      { type: a.type, description: a.description, default: a.default },
    ]),
  ) as Record<string, any>
  return defineCommand({
    meta: {
      name: `make:${kind}`,
      description: owner ? `${generator.description} (${owner})` : generator.description,
    },
    args: {
      name: {
        type: 'positional',
        required: true,
        description: 'The name; a/b/name puts the file in a feature folder',
      },
      force: { type: 'boolean', default: false, description: 'Overwrite an existing file' },
      'dry-run': {
        type: 'boolean',
        default: false,
        description: 'Print what would be written, write nothing',
      },
      ...extra,
    },
    async run({ args }) {
      const ctx = createContext({ dryRun: Boolean(args['dry-run']) })
      const { file, vars } = generator.target(args.name, createProjectInfo(ctx), args)
      const allVars = { name: args.name, ...vars }
      const body = renderStub(kind, generator, allVars, await stubOverrides(ctx.root))
      const written = ctx.write(file, body, { overwrite: args.force })
      if (!written) ctx.log.warn(`${file} exists (use --force)`)
      else if (!ctx.dryRun) ctx.log.success(`${kind}: ${file}`)
      if (written && generator.after)
        await generator.after(createAddContext(ctx, new Codemods(ctx), {}), {
          file,
          vars: allVars,
        })
    },
  })
}

/** One row of `kitr make`: the kind, who owns it, where its files go, and what it is. */
export interface GeneratorRow {
  kind: string
  owner: string
  /** The target for the name `<name>`: `server/controllers/<name>-controller.ts`. */
  pattern: string
  description: string
  definition?: string
}

/**
 * The target pattern of a generator: its own `target()` called with the name `<name>`, so the
 * listing can never drift from what the command writes. `kebab('<name>')` is `<name>`.
 */
export function generatorPattern(generator: Generator, project: ProjectInfo): string {
  const defaults = Object.fromEntries(
    Object.entries(generator.args ?? {}).map(([k, a]) => [k, a.default]),
  )
  try {
    return generator.target(generator.usage ?? '<name>', project, defaults).file
  } catch {
    return '?'
  }
}

/** Every generator available in this project, core first, sorted by kind within each owner. */
export async function generatorRows(ctx = createContext()): Promise<GeneratorRow[]> {
  const project = createProjectInfo(ctx)
  const rows: GeneratorRow[] = Object.entries(coreGenerators).map(([kind, g]) => ({
    kind,
    owner: 'kitr',
    pattern: generatorPattern(g, project),
    description: g.description,
    definition: g.definition,
  }))
  const fromPackages = ctx.rcPath ? await packageGeneratorList(ctx) : []
  for (const { kind, generator, owner } of fromPackages)
    rows.push({
      kind,
      owner,
      pattern: generatorPattern(generator, project),
      description: generator.description,
      definition: generator.definition,
    })
  return rows.sort((a, b) => a.pattern.localeCompare(b.pattern))
}

/** The rows as aligned text: `make:controller  server/controllers/<name>-controller.ts  ...`. */
export function formatGeneratorRows(rows: GeneratorRow[]): string {
  const width = Math.max(...rows.map((r) => r.kind.length)) + 'make:'.length
  const pathWidth = Math.max(...rows.map((r) => r.pattern.length))
  return rows
    .map(
      (r) =>
        `  ${`make:${r.kind}`.padEnd(width)}  ${r.pattern.padEnd(pathWidth)}  ${pc.dim(
          r.definition ?? r.description,
        )}`,
    )
    .join('\n')
}

/** The kind closest to a mistyped one (`make:controler` → `controller`), or undefined. */
export function nearestKind(typed: string, kinds: string[]): string | undefined {
  // Levenshtein over one rolling row.
  const distance = (a: string, b: string) => {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
    for (let i = 1; i <= a.length; i++) {
      const row = [i]
      for (let j = 1; j <= b.length; j++)
        row[j] = Math.min(
          (prev[j] ?? 0) + 1,
          (row[j - 1] ?? 0) + 1,
          (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
        )
      prev = row
    }
    return prev[b.length] ?? 0
  }
  let best: { kind: string; score: number } | undefined
  for (const kind of kinds) {
    const score = distance(typed, kind)
    if (score <= Math.max(2, Math.floor(kind.length / 3)) && (!best || score < best.score))
      best = { kind, score }
  }
  return best?.kind
}

/**
 * `kitr make`: where every kind of file goes in this project, with the command that writes it.
 * The list includes the generators of every installed package, so it is the project's own
 * structure, not a generic one. `--json` prints the rows for agents and tooling.
 */
export const makeCommand = defineCommand({
  meta: {
    name: 'make',
    description: 'List every make:<kind> generator and where its files go',
  },
  args: {
    json: { type: 'boolean', default: false, description: 'Print the list as JSON' },
  },
  async run({ args }) {
    const rows = await generatorRows()
    if (args.json) {
      console.log(JSON.stringify(rows, null, 2))
      return
    }
    console.log(
      `\n${pc.bold('Generators')}  ${pc.dim('kitr make:<kind> <name> [--dry-run] [--force]')}\n`,
    )
    console.log(formatGeneratorRows(rows))
    console.log(
      `\n${pc.dim('Nested names put the file in a feature folder: kitr make:controller admin/users.')}`,
    )
    console.log(pc.dim('Project structure: https://kitr.dev/docs/project-structure\n'))
  },
})

/** The core `make:*` commands, keyed by command name. */
export const coreGeneratorCommands: Record<string, CommandDef<any>> = Object.fromEntries(
  Object.entries(coreGenerators).map(([kind, g]) => [`make:${kind}`, generatorCommand(kind, g)]),
)

/** Every generator the installed packages contribute, keyed by kind, with its owner. */
export async function packageGeneratorList(
  ctx = createContext(),
): Promise<Array<{ kind: string; generator: Generator; owner: string }>> {
  const out: Array<{ kind: string; generator: Generator; owner: string }> = []
  for (const loaded of await installedPackages(ctx))
    for (const [kind, generator] of Object.entries(loaded.definition.generators ?? {}))
      out.push({ kind, generator, owner: loaded.package })
  return out
}

/** Every `make:*` command the installed packages contribute, keyed by command name. */
export async function packageGenerators(
  ctx = createContext(),
): Promise<Record<string, CommandDef<any>>> {
  const out: Record<string, CommandDef<any>> = {}
  for (const { kind, generator, owner } of await packageGeneratorList(ctx))
    out[`make:${kind}`] = generatorCommand(kind, generator, owner)
  return out
}
