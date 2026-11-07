import { existsSync } from 'node:fs'
import { defineCommand } from 'citty'
import { createContext } from '../context'
import { naming, renderStub, type StubFn } from '../stubs'

async function stubOverrides(root: string): Promise<Record<string, StubFn>> {
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

function makeCommand(
  kind: string,
  description: string,
  target: (
    ctx: ReturnType<typeof createContext>,
    name: string,
    args: Record<string, any>,
  ) => { file: string; vars: Record<string, string> },
) {
  return defineCommand({
    meta: { name: `make:${kind}`, description },
    args: {
      name: { type: 'positional', required: true },
      resource: {
        type: 'boolean',
        description: 'controller: generate index/show/store/update/destroy',
        default: false,
      },
      force: { type: 'boolean', default: false },
    },
    async run({ args }) {
      const ctx = createContext()
      const { file, vars } = target(ctx, args.name, args)
      const overrides = await stubOverrides(ctx.root)
      const written = ctx.write(file, renderStub(kind, vars, overrides), { overwrite: args.force })
      if (!written) ctx.log.warn(`${file} exists (use --force)`)
      else ctx.log.success(`${kind}: ${file}`)
    },
  })
}

export const makeRoute = makeCommand('route', 'Create a page route in app/routes', (ctx, name) => {
  // `projects/index` → file app/routes/projects/index.tsx, route path '/projects/' (TanStack's index route form).
  const raw = name.startsWith('/') ? name : `/${name}`
  const isIndex = raw === '/' || raw.endsWith('/index')
  const path = isIndex ? (raw === '/' ? '/' : `${raw.slice(0, -'/index'.length)}/`) : raw
  const file = `${ctx.readRc().directories.routes}/${raw === '/' ? 'index' : raw.slice(1).replace(/:(\w+)/g, '$$$1')}.tsx`
  const base =
    raw
      .split('/')
      .filter((s) => s && s !== 'index')
      .pop()
      ?.replace(/[:$]/g, '') || 'home'
  return { file, vars: { path, name: base } }
})
export const makeAction = makeCommand(
  'action',
  'Create a server action in app/actions/<feature>/<name>.ts',
  (ctx, name) => {
    const [feature, action] = name.includes('/')
      ? (name.split('/') as [string, string])
      : ['app', name]
    return {
      file: `${ctx.readRc().directories.app}/actions/${feature}/${naming.snake(action)}.ts`,
      vars: { feature, name: action },
    }
  },
)
export const makeController = makeCommand(
  'controller',
  'Create a controller in server/controllers',
  (ctx, name, args) => ({
    file: `${ctx.readRc().directories.server ?? 'server'}/controllers/${naming.snake(name)}_controller.ts`,
    vars: { name, resource: String(args.resource) },
  }),
)
export const makeMiddleware = makeCommand(
  'middleware',
  'Create an API middleware in app/middleware',
  (ctx, name) => ({
    file: `${ctx.readRc().directories.app}/middleware/${naming.snake(name)}.ts`,
    vars: { name },
  }),
)
export const makeChannel = makeCommand(
  'channel',
  'Create a socket channel in app/channels',
  (ctx, name) => ({
    file: `${ctx.readRc().directories.app}/channels/${naming.snake(name)}.ts`,
    vars: { name },
  }),
)
export const makeStore = makeCommand(
  'store',
  'Create a Zustand store in app/stores',
  (ctx, name) => ({
    file: `${ctx.readRc().directories.app}/stores/${naming.snake(name)}.ts`,
    vars: { name },
  }),
)
export const makeForm = makeCommand(
  'form',
  'Create a form component in app/components/forms',
  (ctx, name) => ({
    file: `${ctx.readRc().directories.components}/forms/${naming.snake(name)}_form.tsx`,
    vars: { name },
  }),
)
export const makeQueries = makeCommand(
  'queries',
  'Create a feature queries file in app/features/<name>/queries.ts',
  (ctx, name) => ({
    file: `${ctx.readRc().directories.app}/features/${naming.snake(name)}/queries.ts`,
    vars: { name },
  }),
)
export const makeProvider = makeCommand(
  'provider',
  'Create a kitr provider in app/providers',
  (ctx, name) => ({
    file: `${ctx.readRc().directories.app}/providers/${naming.snake(name)}_provider.ts`,
    vars: { name },
  }),
)
export const makeJob = makeCommand(
  'job',
  'Create a background job in server/jobs',
  (ctx, name) => ({
    file: `${ctx.readRc().directories.server ?? 'server'}/jobs/${naming.snake(name)}.ts`,
    vars: { name },
  }),
)
export const makeMail = makeCommand(
  'mail',
  'Create an email template in server/mail',
  (ctx, name) => ({
    file: `${ctx.readRc().directories.server ?? 'server'}/mail/${naming.snake(name)}.tsx`,
    vars: { name },
  }),
)
export const makeService = makeCommand(
  'service',
  'Create a service class in server/services',
  (ctx, name) => ({
    file: `${ctx.readRc().directories.server ?? 'server'}/services/${naming.snake(name)}_service.ts`,
    vars: { name },
  }),
)
export const makeValidator = makeCommand(
  'validator',
  'Create a shared zod schema in app/validators',
  (ctx, name) => ({
    file: `${ctx.readRc().directories.app}/validators/${naming.snake(name)}.ts`,
    vars: { name },
  }),
)
export const makeTest = makeCommand('test', 'Create a vitest file in tests/', (_ctx, name) => ({
  file: `tests/${naming.snake(name)}.test.ts`,
  vars: { name },
}))
export const makeComponent = makeCommand(
  'component',
  'Create a React component in app/components',
  (ctx, name) => ({
    file: `${ctx.readRc().directories.components}/${naming.snake(name).replace(/_/g, '-')}.tsx`,
    vars: { name },
  }),
)
export const makeHook = makeCommand('hook', 'Create a React hook in app/hooks', (ctx, name) => ({
  file: `${ctx.readRc().directories.app}/hooks/use-${naming.snake(name).replace(/_/g, '-')}.ts`,
  vars: { name },
}))
export const makeException = makeCommand(
  'exception',
  'Create a typed error class in app/exceptions',
  (ctx, name) => ({
    file: `${ctx.readRc().directories.app}/exceptions/${naming.snake(name)}_error.ts`,
    vars: { name },
  }),
)
