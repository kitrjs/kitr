/**
 * Generator templates for `kitr make:*`. An app can override any stub by
 * running `kitr eject stub <name>`, which copies it to `stubs/<name>.ts`.
 */
export type StubVars = { name: string; path: string; feature: string; resource: string } & Record<
  string,
  string
>
export type StubFn = (vars: StubVars) => string

const pascal = (s: string) =>
  s.replace(/(^|[-_/\s])(\w)/g, (_, __, c) => c.toUpperCase()).replace(/[^\w]/g, '')
const snake = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s/]+/g, '_')
    .toLowerCase()
const camel = (s: string) => {
  const p = pascal(s)
  return p.charAt(0).toLowerCase() + p.slice(1)
}
export const naming = { pascal, snake, camel }

export const stubs: Record<string, StubFn> = {
  route: ({ path, name }) => `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('${path}')({
  // loader: ({ context }) => context.queryClient.ensureQueryData(${camel(name)}Query.options()),
  component: ${pascal(name)}Page,
})

function ${pascal(name)}Page() {
  return (
    <div>
      <h1>${pascal(name)}</h1>
    </div>
  )
}
`,
  action: ({ name, feature }) => `import { defineAction } from 'kitr/actions'
import { z } from 'zod'

export const ${camel(name)}Input = z.object({
  id: z.string(),
})

export const ${camel(name)} = defineAction('${feature}.${camel(name)}', {
  input: ${camel(name)}Input,
  // What the mutation does to the client cache after success.
  effects: (_result, input) => ({ invalidate: [['${feature}', 'list'], ['${feature}', 'detail', input.id]] }),
  handler: async ({ input }) => {
    // const db = useDb<AppDb>(useRequestApp())
    return { ok: true, id: input.id }
  },
})
`,
  controller: ({ name, resource }) =>
    resource === 'true'
      ? `import type { HttpContext } from 'kitr/api'
import { KitrError } from 'kitr/app'
import { z } from 'zod'

const create${pascal(name)} = z.object({ name: z.string().min(2) })
const update${pascal(name)} = create${pascal(name)}.partial()

export default class ${pascal(name)}Controller {
  static validation = {
    store: { body: create${pascal(name)} },
    update: { body: update${pascal(name)} },
  }

  async index({ query }: HttpContext) {
    return { items: [], page: Number(query.page ?? 1) }
  }

  async show({ params }: HttpContext<{ id: string }>) {
    throw KitrError.notFound('${pascal(name)} ' + params.id)
  }

  async store({ body, response }: HttpContext<{}, {}, z.infer<typeof create${pascal(name)}>>) {
    response.status(201)
    return { id: '1', ...body }
  }

  async update({ params, body }: HttpContext<{ id: string }, {}, z.infer<typeof update${pascal(name)}>>) {
    return { id: params.id, ...body }
  }

  async destroy({ params }: HttpContext<{ id: string }>) {
    void params
  }
}
`
      : `import type { HttpContext } from 'kitr/api'

export default class ${pascal(name)}Controller {
  async handle({ request }: HttpContext) {
    return { path: request.url.pathname }
  }
}
`,
  middleware: ({ name }) => `import { defineMiddleware } from 'kitr/api'

export const ${camel(name)} = defineMiddleware(async (ctx, next) => {
  // Before the handler
  const result = await next()
  // After the handler
  return result
})
`,
  channel: ({ name }) => `import { defineChannel } from 'kitr/realtime'
import { z } from 'zod'

export const ${camel(name)}Channel = defineChannel({
  name: '${snake(name)}',
  params: z.object({ id: z.string() }),
  events: {
    updated: {
      effects: (data: unknown, { id }) => ({ set: [{ key: ['${snake(name)}', 'detail', id], data }] }),
    },
    deleted: {
      effects: () => ({ invalidate: [['${snake(name)}', 'list']] }),
    },
  },
  authorize: () => true,
})
`,
  store: ({ name }) => `import { createKitrStore } from 'kitr/state'

interface ${pascal(name)}State {
  count: number
  increment: () => void
  reset: () => void
}

export const [use${pascal(name)}Store, ${pascal(name)}StoreProvider, ${camel(name)}Store] = createKitrStore<${pascal(name)}State>(
  { name: '${snake(name)}', persist: false },
  (set) => ({
    count: 0,
    increment: () => set((s) => ({ count: s.count + 1 })),
    reset: () => set({ count: 0 }),
  }),
)
`,
  form: ({ name }) => `import { useSchemaForm } from 'kitr/forms'
import { z } from 'zod'
import { FieldInput, Form, FormField, FormMessage, SubmitButton } from '#components/ui/form'

export const ${camel(name)}Schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
})
export type ${pascal(name)}Values = z.infer<typeof ${camel(name)}Schema>

export function ${pascal(name)}Form({ defaultValues, onSubmit }: { defaultValues?: Partial<${pascal(name)}Values>; onSubmit: (values: ${pascal(name)}Values) => Promise<unknown> }) {
  const form = useSchemaForm(${camel(name)}Schema, { defaultValues: { name: '', ...defaultValues } })
  return (
    <Form form={form} onSubmit={onSubmit} className="grid gap-4">
      <FormMessage />
      <FormField name="name" label="Name">
        <FieldInput autoComplete="off" />
      </FormField>
      <SubmitButton>Save</SubmitButton>
    </Form>
  )
}
`,
  queries: ({ name }) => `import { createKeys } from 'kitr/app'
import { defineMutation, defineQuery } from 'kitr/query'
import { httpMutation, httpQuery } from 'kitr/http'
import { app } from '#app/app'

const http = app.container.use('http')
export const ${camel(name)}Keys = createKeys('${snake(name)}')

export interface ${pascal(name)} {
  id: string
  name: string
}

export const ${camel(name)}ListQuery = defineQuery(
  httpQuery<void, ${pascal(name)}[]>(http, { path: '${snake(name)}', key: () => ${camel(name)}Keys.list() }),
)

export const ${camel(name)}Query = defineQuery(
  httpQuery<string, ${pascal(name)}>(http, { path: (id) => \`${snake(name)}/\${id}\`, key: (id) => ${camel(name)}Keys.detail(id) }),
)

export const update${pascal(name)} = defineMutation(
  httpMutation<Partial<${pascal(name)}> & { id: string }, ${pascal(name)}>(http, {
    method: 'patch',
    path: (input) => \`${snake(name)}/\${input.id}\`,
    effects: (result) => ({ set: [{ key: ${camel(name)}Keys.detail(result.id), data: result }], invalidate: [${camel(name)}Keys.lists()] }),
  }),
)
`,
  provider: ({ name }) => `import { defineProvider } from 'kitr/app'

export default defineProvider({
  name: '${snake(name)}',
  register(app) {
    // app.container.singleton('${camel(name)}', () => new ${pascal(name)}Service())
    void app
  },
  async boot(app) {
    void app
  },
  // wrap: (children) => <${pascal(name)}Context.Provider>{children}</${pascal(name)}Context.Provider>,
})
`,
  job: ({ name }) => `import { defineJob } from 'kitr/jobs'
import { z } from 'zod'

export const ${camel(name)}Input = z.object({
  id: z.string(),
})

/** Dispatch with \`jobs.dispatch(${camel(name)}, { id })\`; runs on the worker with retries. */
export const ${camel(name)} = defineJob('${snake(name)}', {
  schema: ${camel(name)}Input,
  retries: 3,
  // schedule: { every: '1h' },
  async run({ id }, ctx) {
    console.info(\`${snake(name)} \${id} (attempt \${ctx.attempt})\`)
  },
})
`,
  mail: ({ name }) => `import { defineMail } from 'kitr/mail'

export interface ${pascal(name)}Props {
  firstName: string
}

/** Send with \`mailer.send(${camel(name)}Mail, props, { to })\`; preview at /_kitr/mail/${snake(name)} in development. */
export const ${camel(name)}Mail = defineMail<${pascal(name)}Props>('${snake(name)}', {
  subject: ({ firstName }) => \`${pascal(name)} for \${firstName}\`,
  preview: { firstName: 'Ada' },
  render: ({ firstName }) => (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
        <h1>Hello {firstName}</h1>
        <p>Replace this with the message.</p>
      </body>
    </html>
  ),
})
`,
  service: ({ name }) => `import type { KitrApp } from 'kitr/app'

/**
 * Plain class with the business logic for ${snake(name)}; bind it in a provider:
 *   app.container.singleton('${camel(name)}', () => new ${pascal(name)}Service(app))
 */
export class ${pascal(name)}Service {
  constructor(private readonly app: KitrApp) {}

  async list() {
    void this.app
    return []
  }
}

declare module 'kitr/app' {
  interface ContainerBindings {
    ${camel(name)}: ${pascal(name)}Service
  }
}
`,
  validator: ({ name }) => `import { z } from 'zod'

/** Shared between the form, the action and the controller, so one schema decides what is valid. */
export const ${camel(name)}Schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
})

export const create${pascal(name)}Schema = ${camel(name)}Schema
export const update${pascal(name)}Schema = ${camel(name)}Schema.partial()

export type ${pascal(name)}Input = z.infer<typeof ${camel(name)}Schema>
`,
  test: ({ name }) => `import { createTestApp, createTestClient } from 'kitr/testing'
import { describe, expect, it } from 'vitest'

describe('${snake(name)}', () => {
  it('works', async () => {
    const app = await createTestApp()
    const client = createTestClient(app)
    const res = await client.get('/api/health')
    expect(res.status).toBe(200)
  })
})
`,
  component: ({ name }) => `import type { ReactNode } from 'react'

export interface ${pascal(name)}Props {
  children?: ReactNode
  className?: string
}

export function ${pascal(name)}({ children, className }: ${pascal(name)}Props) {
  return <div className={className}>{children}</div>
}
`,
  hook: ({ name }) => `import { useCallback, useState } from 'react'

export function use${pascal(name)}(initial = false) {
  const [value, setValue] = useState(initial)
  const toggle = useCallback(() => setValue((v) => !v), [])
  return { value, setValue, toggle }
}
`,
  exception: ({ name }) => `import { KitrError } from 'kitr/app'

/**
 * Thrown from actions and controllers; the API layer turns it into a JSON error with the
 * right status and the client gets a typed \`KitrError\` back.
 */
export class ${pascal(name)}Error extends KitrError {
  constructor(message = '${pascal(name)}', data?: unknown) {
    super('BAD_REQUEST', message, { data })
    this.name = '${pascal(name)}Error'
  }
}
`,
}

export function renderStub(
  name: string,
  vars: Partial<StubVars> & Record<string, string>,
  overrides: Record<string, StubFn> = {},
): string {
  const fn = overrides[name] ?? stubs[name]
  if (!fn) throw new Error(`Unknown stub "${name}"`)
  return fn({ name: '', path: '', feature: '', resource: '', ...vars })
}
