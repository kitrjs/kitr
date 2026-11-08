import { existsSync } from 'node:fs'
import { type Generator, type GeneratorVars, naming } from '@kitr/core/package'
import { type CommandDef, defineCommand } from 'citty'
import { createAddContext, createProjectInfo } from '../add-context'
import { Codemods } from '../codemods'
import { createContext } from '../context'
import { installedPackages } from '../packages'

export type StubFn = (vars: GeneratorVars) => string

/**
 * `kitr make:<kind>`. The core ships the three generators that need no package (a provider, a
 * service, an exception); every other generator comes from the package that owns the code it
 * writes (`make:route` from router, `make:job` from jobs...). A project overrides any stub with
 * `kitr eject stub <kind>`, which copies it to `stubs/<kind>.ts`.
 */
// kitr-allow-module-state: lookup table built once at import, never mutated
export const coreGenerators: Record<string, Generator> = {
  provider: {
    description: 'Create a kitr provider in app/providers',
    target: (name, project) => ({
      file: `${project.rc.directories.app ?? 'app'}/providers/${naming.snake(name)}_provider.ts`,
    }),
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
  },
  service: {
    description: 'Create a service class in server/services',
    target: (name, project) => ({
      file: `${project.rc.directories.server ?? 'server'}/services/${naming.snake(name)}_service.ts`,
    }),
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
    target: (name, project) => ({
      file: `${project.rc.directories.app ?? 'app'}/exceptions/${naming.snake(name)}_error.ts`,
    }),
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
      name: { type: 'positional', required: true },
      force: { type: 'boolean', default: false },
      ...extra,
    },
    async run({ args }) {
      const ctx = createContext()
      const { file, vars } = generator.target(args.name, createProjectInfo(ctx), args)
      const body = renderStub(
        kind,
        generator,
        { name: args.name, ...vars },
        await stubOverrides(ctx.root),
      )
      const written = ctx.write(file, body, { overwrite: args.force })
      if (!written) ctx.log.warn(`${file} exists (use --force)`)
      else ctx.log.success(`${kind}: ${file}`)
      if (written && generator.after)
        await generator.after(createAddContext(ctx, new Codemods(ctx), {}), {
          file,
          vars: { name: args.name, ...vars },
        })
    },
  })
}

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
