import { rmSync } from 'node:fs'
import type { ProjectContext } from './context'
import type { Kit } from './kits'
import { baseReact } from './kits-base'

/**
 * Preset kits: opinionated starting points on top of the base kits. Each one is a
 * real, runnable app (the `examples/` folder is generated from them), so the preset
 * doubles as living documentation for how the packages fit together.
 */

const write = (ctx: ProjectContext, path: string, content: string) =>
  ctx.write(path, content, { overwrite: true })

const remove = (ctx: ProjectContext, ...paths: string[]) => {
  for (const p of paths) rmSync(ctx.path(p), { force: true, recursive: true })
}

const addScript = (ctx: ProjectContext, name: string, command: string) => {
  const pkg = JSON.parse(ctx.read('package.json'))
  pkg.scripts = { ...pkg.scripts, [name]: command }
  write(ctx, 'package.json', `${JSON.stringify(pkg, null, 2)}\n`)
}

/** TanStack Start root route: the HTML shell, with whatever `children` the preset wants around <Outlet />. */
const startRoot = (options: {
  imports: string
  head: string
  body: string
  extra?: string
  /** Extra route options (loader, beforeLoad…), inserted before `component`. */
  route?: string
  /** Statements at the top of RootLayout. */
  prelude?: string
  /** Opening and closing JSX around the layout body. */
  wrap?: [open: string, close: string]
}) =>
  `import type { KitrRouterContext } from 'kitr/router'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from 'kitr/router'
import type { ReactNode } from 'react'
import css from '#app/styles/app.css?url'
${options.imports}
export const Route = createRootRouteWithContext<KitrRouterContext>()({
  head: () => ({
${options.head}
    links: [{ rel: 'stylesheet', href: css }],
  }),
${options.route ?? ''}  component: RootLayout,
})

function RootLayout() {
${options.prelude ?? ''}  return (
    <RootDocument>
${options.wrap ? `${options.wrap[0]}\n` : ''}${options.body}
${options.wrap ? `${options.wrap[1]}\n` : ''}    </RootDocument>
  )
}
${options.extra ?? ''}
/** The HTML shell. Start streams it on the server and hydrates it on the client. */
function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
`

const routeTable = (routes: Array<[name: string, method: string, path: string]>) =>
  `// Route table for the typed client. Regenerate with \`kitr api:sync\`.\nexport const routeTable = ${JSON.stringify(
    routes.map(([name, method, path]) => ({ name, method, path })),
    null,
    2,
  )} as const\n`

const apiClient = `import { createApiClient, registerRoutes } from 'kitr/api/client'
import type { AppRoutes } from '#server/routes'
import { routeTable } from './routes.gen'

/** Typed, no codegen: route names, params, bodies and outputs come from the router. */
export const api = createApiClient<AppRoutes>({
  baseUrl: typeof window === 'undefined' ? 'http://localhost:' + (process.env.PORT ?? 3000) : '',
})
registerRoutes(api, [...routeTable])
`

// ---------------------------------------------------------------------------
// saas: a logged-in product on its own API
// ---------------------------------------------------------------------------

const saasExtra = (ctx: ProjectContext, name: string) => {
  const brand = displayName(name)
  remove(ctx, 'app/routes/index.tsx', 'app/routes/about.tsx')
  addScript(ctx, 'api:sync', 'kitr api:sync')

  write(
    ctx,
    'app/features/projects/schema.ts',
    `import { z } from 'zod'

/** Shared by the controller (validation) and the form (client-side checks). */
export const createProjectSchema = z.object({
  name: z.string().min(2, 'Give the project a name'),
  status: z.enum(['active', 'archived']).default('active'),
})
export const updateProjectSchema = createProjectSchema.partial()

export type CreateProject = z.infer<typeof createProjectSchema>
export type UpdateProject = z.infer<typeof updateProjectSchema>

export interface Project {
  id: string
  name: string
  status: 'active' | 'archived'
  owner: string
  updatedAt: string
}
`,
  )

  write(
    ctx,
    'server/controllers/projects_controller.ts',
    `import type { HttpContext } from 'kitr/api'
import { KitrError } from 'kitr/app'
import {
  type CreateProject,
  type Project,
  type UpdateProject,
  createProjectSchema,
  updateProjectSchema,
} from '#app/features/projects/schema'

type Ctx<B = unknown> = HttpContext<{ id: string }, Record<string, string | string[]>, B>

/** In-memory for the demo. Swap for a database binding (\`kitr add db\`) without touching the routes. */
const projects = new Map<string, Project>()
for (const [i, name] of ['Onboarding revamp', 'Billing v2', 'Mobile beta'].entries()) {
  const id = String(i + 1)
  projects.set(id, {
    id,
    name,
    status: i === 2 ? 'archived' : 'active',
    owner: 'admin@example.com',
    updatedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
  })
}

export default class ProjectsController {
  static validation = {
    store: { body: createProjectSchema },
    update: { body: updateProjectSchema },
  }

  async index() {
    return [...projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async show({ params }: Ctx) {
    const project = projects.get(params.id)
    if (!project) throw KitrError.notFound('Project ' + params.id)
    return project
  }

  async store({ body, response }: Ctx<CreateProject>) {
    const project: Project = {
      id: crypto.randomUUID(),
      name: body.name,
      status: body.status,
      owner: 'you@example.com',
      updatedAt: new Date().toISOString(),
    }
    projects.set(project.id, project)
    response.status(201)
    return project
  }

  async update({ params, body }: Ctx<UpdateProject>) {
    const current = projects.get(params.id)
    if (!current) throw KitrError.notFound('Project ' + params.id)
    const next: Project = { ...current, ...body, updatedAt: new Date().toISOString() }
    projects.set(params.id, next)
    return next
  }

  async destroy({ params, response }: Ctx) {
    projects.delete(params.id)
    return response.noContent()
  }
}
`,
  )

  write(
    ctx,
    'server/controllers/auth_controller.ts',
    `import type { HttpContext } from 'kitr/api'
import { KitrError } from 'kitr/app'
import { z } from 'zod'
import type { User } from '#app/abilities'

const credentials = z.object({ email: z.email(), password: z.string().min(1) })
type Ctx<B = unknown> = HttpContext<Record<string, string>, Record<string, string | string[]>, B>

/**
 * Demo identity: any email signs in with the password "password"; emails starting with
 * "admin" get the admin role. Tokens live in memory. Replace with your identity provider
 * (or \`betterAuthAdapter\` in config/auth.ts) and delete this file.
 */
const sessions = new Map<string, User>()

export default class AuthController {
  static validation = { signIn: { body: credentials } }

  async signIn({ body, response }: Ctx<z.infer<typeof credentials>>) {
    if (body.password !== 'password') throw KitrError.unauthorized('Wrong email or password')
    const user: User = {
      id: body.email,
      email: body.email,
      role: body.email.startsWith('admin') ? 'admin' : 'member',
    }
    const token = crypto.randomUUID()
    sessions.set(token, user)
    response.status(201)
    return { token, user }
  }

  async me({ request }: Ctx) {
    const token = request.header('authorization')?.replace(/^Bearer /i, '')
    const user = token ? sessions.get(token) : undefined
    if (!user) throw KitrError.unauthorized()
    return user
  }

  async signOut({ request, response }: Ctx) {
    const token = request.header('authorization')?.replace(/^Bearer /i, '')
    if (token) sessions.delete(token)
    return response.noContent()
  }
}
`,
  )

  write(
    ctx,
    'server/routes.ts',
    `import { cors, defineRoutes } from 'kitr/api'
import AuthController from '#server/controllers/auth_controller'
import HealthController from '#server/controllers/health_controller'
import ProjectsController from '#server/controllers/projects_controller'

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api', middleware: [cors()] }, (api) =>
    api
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .post('/auth/sign-in', [AuthController, 'signIn'], { name: 'auth.signIn' })
      .post('/auth/sign-out', [AuthController, 'signOut'], { name: 'auth.signOut' })
      .get('/auth/me', [AuthController, 'me'], { name: 'auth.me' })
      .resource('projects', ProjectsController),
  ),
)

/** Pass to createApiClient<AppRoutes>() on the client. */
export type AppRoutes = typeof routes.$types
`,
  )
  write(
    ctx,
    'app/api/routes.gen.ts',
    routeTable([
      ['health', 'GET', '/api/health'],
      ['auth.signIn', 'POST', '/api/auth/sign-in'],
      ['auth.signOut', 'POST', '/api/auth/sign-out'],
      ['auth.me', 'GET', '/api/auth/me'],
      ['projects.index', 'GET', '/api/projects'],
      ['projects.store', 'POST', '/api/projects'],
      ['projects.show', 'GET', '/api/projects/:id'],
      ['projects.update', 'PATCH', '/api/projects/:id'],
      ['projects.destroy', 'DELETE', '/api/projects/:id'],
    ]),
  )
  write(ctx, 'app/api/client.ts', apiClient)

  write(
    ctx,
    'config/auth.ts',
    `import { defineConfig, localStorageTokens, tokenAdapter } from 'kitr/auth'
import { type User, abilities } from '#app/abilities'
import { api } from '#app/api/client'

/**
 * Tokens come from this app's own API (server/controllers/auth_controller.ts).
 * Swap for betterAuthAdapter(createAuthClient()) or a customAdapter({...}) when you have a real identity provider.
 */
const adapter = tokenAdapter<User>({
  abilities,
  storage: localStorageTokens(),
  fetchUser: async (token) => {
    const res = await fetch(api.auth.me.url(), { headers: { authorization: 'Bearer ' + token } })
    return res.ok ? ((await res.json()) as User) : null
  },
  signIn: (credentials) => api.auth.signIn({ body: credentials }),
})

export default defineConfig({ adapter, signInPath: '/sign-in' })
`,
  )

  write(
    ctx,
    'config/http.ts',
    `import { defineConfig } from 'kitr/http'

/** Same-origin API; the bearer token is attached by the auth provider once signed in. */
export default defineConfig({
  baseUrl: '/api',
})
`,
  )

  write(
    ctx,
    'app/router.tsx',
    `import type { Session } from 'kitr/auth'
import { createKitrRouter } from 'kitr/router'
import type { User } from '#app/abilities'
import { app } from './app'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createKitrRouter({
    routeTree,
    app,
    context: {
      // A live getter, so \`requireAuth()\` sees the session the auth provider restores during boot.
      get session() {
        return app.container.has('auth') ? (app.container.use('auth').session as Session<User>) : null
      },
    },
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

declare module '@kitr/router' {
  interface KitrRouterContext {
    session: Session<User> | null
  }
}
`,
  )

  write(
    ctx,
    'app/features/projects/queries.ts',
    `import { defineMutation, defineQuery } from 'kitr/query'
import { api } from '#app/api/client'

/** One place for every query and mutation of the feature; routes and components import from here. */
export const projectsQuery = defineQuery(api.projects.index.query())

export const createProject = defineMutation(
  api.projects.store.mutation({ effects: { invalidate: [api.projects.index.key()] } }),
)

export const deleteProject = defineMutation(
  api.projects.destroy.mutation({ effects: { invalidate: [api.projects.index.key()] } }),
)
`,
  )

  write(
    ctx,
    'app/routes/__root.tsx',
    startRoot({
      imports: '',
      head: `    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: '${brand}' },
    ],`,
      body: '      <Outlet />',
    }),
  )

  write(
    ctx,
    'app/routes/sign-in.tsx',
    `import { createFileRoute } from '@tanstack/react-router'
import { useAnalytics } from 'kitr/analytics/react'
import { useAuth } from 'kitr/auth'
import { useSchemaForm } from 'kitr/forms'
import { useNavigate } from 'kitr/router'
import { z } from 'zod'
import type { User } from '#app/abilities'
import type { AppEvents } from '#app/analytics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { FieldInput, Form, FormField, FormMessage, SubmitButton } from '#components/ui/form'

const signInSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export const Route = createFileRoute('/sign-in')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: SignInPage,
})

function SignInPage() {
  const { redirect } = Route.useSearch()
  const navigate = useNavigate()
  const auth = useAuth<User, z.infer<typeof signInSchema>>()
  const analytics = useAnalytics<AppEvents>()
  const form = useSchemaForm(signInSchema, { defaultValues: { email: '', password: '' } })

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to ${brand}</CardTitle>
          <CardDescription>Any email works in this demo. The password is "password".</CardDescription>
        </CardHeader>
        <CardContent>
          <Form
            form={form}
            className="grid gap-4"
            onSubmit={async (values) => {
              await auth.signIn(values)
              analytics.track('sign-in.completed', { method: 'password' })
              await navigate({ to: redirect ?? '/' })
            }}
          >
            <FormMessage />
            <FormField name="email" label="Email">
              <FieldInput type="email" autoComplete="email" placeholder="you@example.com" />
            </FormField>
            <FormField name="password" label="Password">
              <FieldInput type="password" autoComplete="current-password" />
            </FormField>
            <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
`,
  )

  write(
    ctx,
    'app/routes/_app.tsx',
    `import { createFileRoute } from '@tanstack/react-router'
import { type Session, useAuth, useUser } from 'kitr/auth'
import { Outlet, requireAuth, useNavigate } from 'kitr/router'
import { ssrRoute } from 'kitr/seo'
import { Folder01Icon, Home01Icon, Logout01Icon } from '@hugeicons/core-free-icons'
import type { User } from '#app/abilities'
import { AppShell } from '#components/ui/app-shell'
import { Button } from '#components/ui/button'
import { Icon } from '#components/ui/icon'

/**
 * Pathless layout: everything under it needs a session. The guard runs on the client only
 * (the token lives in localStorage), so the layout opts out of SSR.
 */
export const Route = createFileRoute('/_app')({
  ...ssrRoute(false),
  beforeLoad: async ({ context, location }) => {
    // Read the live session from the container: the router copies its context object,
    // so a value captured at creation time would be stale after sign-in.
    await context.app.boot()
    const session = context.app.container.use('auth').session as Session<User>
    return requireAuth()({ context: { session }, location })
  },
  component: AppLayout,
})

function AppLayout() {
  const auth = useAuth<User>()
  const user = useUser<User>()
  const navigate = useNavigate()
  return (
    <AppShell
      brand="${brand}"
      nav={[
        { to: '/', label: 'Overview', icon: <Icon icon={Home01Icon} /> },
        { to: '/projects', label: 'Projects', icon: <Icon icon={Folder01Icon} /> },
      ]}
      user={
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden text-muted-foreground sm:inline">{user?.email}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await auth.signOut()
              await navigate({ to: '/sign-in', search: { redirect: undefined } })
            }}
          >
            <Icon icon={Logout01Icon} />
            Sign out
          </Button>
        </div>
      }
    >
      <Outlet />
    </AppShell>
  )
}
`,
  )

  write(
    ctx,
    'app/routes/_app/index.tsx',
    `import { createFileRoute } from '@tanstack/react-router'
import { useUser } from 'kitr/auth'
import { useSuspenseQuery } from 'kitr/query'
import { Link } from 'kitr/router'
import type { User } from '#app/abilities'
import { projectsQuery } from '#app/features/projects/queries'
import { buttonVariants } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { PageHeader } from '#components/ui/page-header'

export const Route = createFileRoute('/_app/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery.options({})),
  component: OverviewPage,
})

function OverviewPage() {
  const user = useUser<User>()
  const { data: projects } = useSuspenseQuery(projectsQuery.options({}))
  const active = projects.filter((p) => p.status === 'active')
  const stats = [
    { label: 'Projects', value: projects.length },
    { label: 'Active', value: active.length },
    { label: 'Archived', value: projects.length - active.length },
  ]
  return (
    <>
      <PageHeader
        title={'Welcome back' + (user ? ', ' + user.email.split('@')[0] : '')}
        description="What changed since you were last here."
        actions={
          <Link to="/projects" className={buttonVariants()}>
            All projects
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recently updated</CardTitle>
          <CardDescription>The last three projects anyone touched.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {projects.slice(0, 3).map((project) => (
              <li key={project.id} className="flex items-center justify-between py-2 text-sm">
                <span>{project.name}</span>
                <span className="text-muted-foreground">
                  {new Date(project.updatedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
`,
  )

  write(
    ctx,
    'app/routes/_app/projects.tsx',
    `import { createFileRoute } from '@tanstack/react-router'
import { useAnalytics } from 'kitr/analytics/react'
import { useSchemaForm } from 'kitr/forms'
import { useKitrMutation, useSuspenseQuery } from 'kitr/query'
import {
  type ColumnDef,
  type DataTableFeatures,
  parseTableSearch,
  useUrlTableState,
} from 'kitr/table'
import { useState } from 'react'
import type { AppEvents } from '#app/analytics'
import { createProject, deleteProject, projectsQuery } from '#app/features/projects/queries'
import { type Project, createProjectSchema } from '#app/features/projects/schema'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { DataTable } from '#components/ui/data-table'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
import { FieldInput, Form, FormField, FormMessage, SubmitButton } from '#components/ui/form'
import { PageHeader } from '#components/ui/page-header'

export const Route = createFileRoute('/_app/projects')({
  validateSearch: parseTableSearch,
  loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery.options({})),
  component: ProjectsPage,
})

function ProjectsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const tableState = useUrlTableState({
    search,
    setSearch: (patch) => navigate({ search: (prev: typeof search) => ({ ...prev, ...patch }) }),
  })
  const { data } = useSuspenseQuery(projectsQuery.options({}))
  const remove = useKitrMutation(deleteProject)
  const [open, setOpen] = useState(false)

  const columns: ColumnDef<DataTableFeatures, Project>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>
          {row.original.status}
        </Badge>
      ),
    },
    { accessorKey: 'owner', header: 'Owner' },
    {
      accessorKey: 'updatedAt',
      header: 'Updated',
      cell: ({ row }) => new Date(row.original.updatedAt).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={remove.isPending}
          onClick={() => remove.mutate({ params: { id: row.original.id } })}
        >
          Delete
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Projects"
        description="Sorting and paging live in the URL, so links are shareable."
        actions={<Button onClick={() => setOpen(true)}>New project</Button>}
      />
      <DataTable columns={columns} data={data} rowCount={data.length} {...tableState} />
      <NewProjectDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useKitrMutation(createProject)
  const analytics = useAnalytics<AppEvents>()
  const form = useSchemaForm(createProjectSchema, { defaultValues: { name: '', status: 'active' } })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
        <DialogDescription>Validated by the same schema the API uses.</DialogDescription>
      </DialogHeader>
      <Form
        form={form}
        className="grid gap-4"
        resetOnSuccess
        onSubmit={async (values) => {
          const project = await create.mutateAsync({ body: values })
          analytics.track('project.created', { id: project.id })
          onOpenChange(false)
        }}
      >
        <FormMessage />
        <FormField name="name" label="Name">
          <FieldInput autoFocus placeholder="Q3 launch" />
        </FormField>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton pendingText="Creating…">Create</SubmitButton>
        </DialogFooter>
      </Form>
    </Dialog>
  )
}
`,
  )

  write(
    ctx,
    'test/api.test.ts',
    `// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { server } from '#server/main'

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

describe('api', () => {
  it('signs in and lists projects', async () => {
    const signIn = await server.fetch(
      new Request('http://app/api/auth/sign-in', json({ email: 'me@example.com', password: 'password' })),
    )
    expect(signIn.status).toBe(201)
    const { token } = (await signIn.json()) as { token: string }

    const me = await server.fetch(
      new Request('http://app/api/auth/me', { headers: { authorization: 'Bearer ' + token } }),
    )
    expect(((await me.json()) as { email: string }).email).toBe('me@example.com')

    const list = await server.fetch(new Request('http://app/api/projects'))
    expect(list.status).toBe(200)
    expect(Array.isArray(await list.json())).toBe(true)
  })

  it('validates new projects', async () => {
    const res = await server.fetch(new Request('http://app/api/projects', json({ name: 'x' })))
    expect(res.status).toBe(422)
  })
})
`,
  )
}

// ---------------------------------------------------------------------------
// site: a marketing site with SSR, prerendering, i18n and a blog
// ---------------------------------------------------------------------------

const siteExtra = (ctx: ProjectContext, name: string) => {
  const brand = displayName(name)
  remove(ctx, 'app/routes/index.tsx', 'app/routes/about.tsx')
  addScript(ctx, 'api:sync', 'kitr api:sync')

  write(
    ctx,
    'app/locales/en.ts',
    `export default {
  common: {
    nav: { home: 'Home', pricing: 'Pricing', blog: 'Blog' },
    hero: {
      title: 'Ship the whole product, not just the UI',
      subtitle:
        'One stack from routes to sockets, with every piece an add-on you can remove. This page is server-rendered, prerendered and translated.',
      cta: 'Read the blog',
      secondary: 'See pricing',
    },
    features: {
      ssr: { title: 'Server rendered', body: 'HTML first, hydrated in place. Prerendered at build time for the pages that never change.' },
      i18n: { title: 'Translated', body: 'Typed keys from the English bundle; add a locale by adding a file.' },
      api: { title: 'An API in the same app', body: 'The newsletter form below posts to a controller two folders away.' },
    },
    newsletter: {
      title: 'Get the monthly letter',
      placeholder: 'you@example.com',
      button: 'Subscribe',
      success: 'Thanks, you are on the list.',
    },
    footer: 'Built with kitr',
    locale: 'Deutsch',
  },
} as const

/** The shape every other locale must match: same keys, any strings. */
export type Bundle<T> = { [K in keyof T]: T[K] extends string ? string : Bundle<T[K]> }
`,
  )
  write(
    ctx,
    'app/locales/de.ts',
    `import type { Bundle } from './en'
import type en from './en'

const de = {
  common: {
    nav: { home: 'Start', pricing: 'Preise', blog: 'Blog' },
    hero: {
      title: 'Liefere das ganze Produkt, nicht nur die Oberfläche',
      subtitle:
        'Ein Stack von Routen bis Sockets, jedes Teil ein Add-on. Diese Seite wird serverseitig gerendert, vorgerendert und übersetzt.',
      cta: 'Zum Blog',
      secondary: 'Preise ansehen',
    },
    features: {
      ssr: { title: 'Serverseitig gerendert', body: 'HTML zuerst, danach hydriert. Statische Seiten werden beim Build vorgerendert.' },
      i18n: { title: 'Übersetzt', body: 'Typisierte Schlüssel aus dem englischen Bundle; eine Sprache ist eine Datei.' },
      api: { title: 'Eine API in derselben App', body: 'Das Newsletter-Formular unten schickt an einen Controller zwei Ordner weiter.' },
    },
    newsletter: {
      title: 'Der monatliche Brief',
      placeholder: 'du@example.com',
      button: 'Abonnieren',
      success: 'Danke, du stehst auf der Liste.',
    },
    footer: 'Gebaut mit kitr',
    locale: 'English',
  },
} as const satisfies Bundle<typeof en>

export default de
`,
  )
  write(
    ctx,
    'config/i18n.ts',
    `import { defineConfig } from 'kitr/i18n'
import de from '#app/locales/de'
import en from '#app/locales/en'

export default defineConfig({
  resources: { en, de },
  defaultLocale: 'en',
  defaultNS: 'common',
  // The visitor's choice lives in a cookie; app/locale.tsx renders each request in that language.
  detect: false,
})
`,
  )
  write(
    ctx,
    'app/storage.ts',
    `import { defineCookie } from 'kitr/storage'

export type Locale = 'en' | 'de'

/** The visitor's language choice. A cookie, so the server can render the right language on the first byte. */
export const localeCookie = defineCookie<Locale>('locale', {
  default: 'en',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
`,
  )
  write(
    ctx,
    'app/locale.tsx',
    `import { I18nextProvider, useTranslation } from 'kitr/i18n'
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { type Locale, localeCookie } from '#app/storage'

interface LocaleState {
  locale: Locale
  setLocale: (next: Locale) => void
}

const LocaleContext = createContext<LocaleState | null>(null)

/**
 * Renders the tree in one language per request.
 *
 * The root loader reads the cookie on the server, so streamed pages arrive in the right language
 * and hydrate without mismatches. Prerendered pages are built in the default language and catch up
 * in an effect after hydration, which is safe because the update lands after React has matched the markup.
 */
export function LocaleProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const { i18n } = useTranslation()
  const [locale, setLocaleState] = useState<Locale>(initial)
  const instance = useMemo(() => i18n.cloneInstance({ lng: locale }), [i18n, locale])

  useEffect(() => {
    setLocaleState(localeCookie.get())
  }, [])

  const value = useMemo<LocaleState>(
    () => ({
      locale,
      setLocale(next) {
        localeCookie.set(next)
        setLocaleState(next)
      },
    }),
    [locale],
  )

  return (
    <LocaleContext.Provider value={value}>
      <I18nextProvider i18n={instance}>{children}</I18nextProvider>
    </LocaleContext.Provider>
  )
}

export function useLocale(): LocaleState {
  const state = useContext(LocaleContext)
  if (!state) throw new Error('useLocale() needs <LocaleProvider> above it')
  return state
}
`,
  )
  write(
    ctx,
    'app/components/locale-switch.tsx',
    `import { useTranslation } from 'kitr/i18n'
import { useLocale } from '#app/locale'
import { Button } from '#components/ui/button'

/** Toggles en ⇄ de and remembers it in a cookie. */
export function LocaleSwitch() {
  const { t } = useTranslation()
  const { locale, setLocale } = useLocale()
  return (
    <Button variant="ghost" size="sm" onClick={() => setLocale(locale === 'en' ? 'de' : 'en')}>
      {t('locale')}
    </Button>
  )
}
`,
  )

  write(
    ctx,
    'app/content/posts.ts',
    `/** Content lives in code for the demo; swap for a CMS or MDX loader and keep the routes. */
export interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  body: string[]
}

export const posts: Post[] = [
  {
    slug: 'why-everything-is-an-add-on',
    title: 'Why everything is an add-on',
    excerpt: 'A framework you can take apart is a framework you can keep.',
    date: '2026-10-02',
    body: [
      'Most frameworks grow by absorbing features. Each one is useful to someone and dead weight to everyone else.',
      'kitr goes the other way: the core is a container, a config store and a provider lifecycle. Routing, data, forms, auth and sockets are packages you add with one command and remove with another.',
      'This site uses ssr, i18n, api and forms. Nothing else is in the bundle.',
    ],
  },
  {
    slug: 'prerender-what-never-changes',
    title: 'Prerender what never changes',
    excerpt: 'Static HTML for the pages that are static, SSR for the rest.',
    date: '2026-10-16',
    body: [
      'config/seo.ts lists the routes to prerender and crawls links from them at build time, so this post is a plain HTML file on the CDN.',
      'Pages that depend on the request keep rendering on the server; heavy, non-SEO pages can opt out with ssrRoute(false).',
    ],
  },
  {
    slug: 'one-form-one-controller',
    title: 'One form, one controller',
    excerpt: 'The newsletter box on the home page is a full round trip through the stack.',
    date: '2026-11-01',
    body: [
      'The form validates with a zod schema, posts through the typed API client, and lands in NewsletterController. The same schema validates on both sides.',
      'Add a database binding and the controller writes rows; the form does not change.',
    ],
  },
]

export const getPost = (slug: string) => posts.find((p) => p.slug === slug)
`,
  )

  write(
    ctx,
    'app/features/newsletter/schema.ts',
    `import { z } from 'zod'

export const subscribeSchema = z.object({ email: z.email('Enter a valid email') })
export type Subscribe = z.infer<typeof subscribeSchema>
`,
  )
  write(
    ctx,
    'server/controllers/newsletter_controller.ts',
    `import type { HttpContext } from 'kitr/api'
import { type Subscribe, subscribeSchema } from '#app/features/newsletter/schema'

/** In-memory for the demo; a real app would write to a database or an email provider. */
const subscribers = new Set<string>()

export default class NewsletterController {
  static validation = { subscribe: { body: subscribeSchema } }

  async subscribe({ body, logger }: HttpContext<Record<string, string>, Record<string, string | string[]>, Subscribe>) {
    subscribers.add(body.email)
    logger.info('newsletter: subscribed', { email: body.email })
    return { ok: true, count: subscribers.size }
  }
}
`,
  )
  write(
    ctx,
    'server/routes.ts',
    `import { cors, defineRoutes } from 'kitr/api'
import HealthController from '#server/controllers/health_controller'
import NewsletterController from '#server/controllers/newsletter_controller'

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api', middleware: [cors()] }, (api) =>
    api
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .post('/newsletter', [NewsletterController, 'subscribe'], { name: 'newsletter.subscribe' }),
  ),
)

/** Pass to createApiClient<AppRoutes>() on the client. */
export type AppRoutes = typeof routes.$types
`,
  )
  write(
    ctx,
    'app/api/routes.gen.ts',
    routeTable([
      ['health', 'GET', '/api/health'],
      ['newsletter.subscribe', 'POST', '/api/newsletter'],
    ]),
  )
  write(ctx, 'app/api/client.ts', apiClient)

  write(
    ctx,
    'config/seo.ts',
    `import { defineConfig } from 'kitr/seo'

export default defineConfig({
  ssr: true,
  // Static HTML at build time for these and every page linked from them.
  prerender: { routes: ['/', '/pricing', '/blog'], crawlLinks: true },
  site: { name: '${brand}', url: 'https://example.com' },
})
`,
  )

  write(
    ctx,
    'app/routes/__root.tsx',
    startRoot({
      imports: `import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { useTranslation } from 'kitr/i18n'
import { Link } from 'kitr/router'
import { seo } from 'kitr/seo'
import { LocaleSwitch } from '#app/components/locale-switch'
import { LocaleProvider } from '#app/locale'
import { localeCookie } from '#app/storage'
import { ThemeToggle } from '#components/ui/theme-toggle'

/** Runs on the server only: the visitor's language, straight from the request cookie. */
const readLocale = createServerFn({ method: 'GET' }).handler(() =>
  localeCookie.get(getRequest().headers),
)
`,
      route: `  loader: () => readLocale(),
`,
      prelude: `  const locale = Route.useLoaderData()
`,
      wrap: ['      <LocaleProvider initial={locale}>', '      </LocaleProvider>'],
      head: `    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ...seo({ title: '${brand}', description: 'A marketing site built with kitr.' }).meta,
    ],`,
      body: `      <SiteHeader />
      <Outlet />
      <SiteFooter />`,
      extra: `
function SiteHeader() {
  const { t } = useTranslation()
  const link = 'rounded-md px-3 py-1.5 text-sm hover:bg-muted [&.active]:bg-muted [&.active]:font-medium'
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-4">
        <Link to="/" className="mr-4 font-semibold">
          ${brand}
        </Link>
        <Link to="/" className={link} activeOptions={{ exact: true }} activeProps={{ className: 'active' }}>
          {t('nav.home')}
        </Link>
        <Link to="/pricing" className={link} activeProps={{ className: 'active' }}>
          {t('nav.pricing')}
        </Link>
        <Link to="/blog" className={link} activeProps={{ className: 'active' }}>
          {t('nav.blog')}
        </Link>
        <div className="flex-1" />
        <LocaleSwitch />
        <ThemeToggle />
      </div>
    </header>
  )
}

function SiteFooter() {
  const { t } = useTranslation()
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground">{t('footer')}</div>
    </footer>
  )
}
`,
    }),
  )

  write(
    ctx,
    'app/routes/index.tsx',
    `import { createFileRoute } from '@tanstack/react-router'
import { useSchemaForm } from 'kitr/forms'
import { useTranslation } from 'kitr/i18n'
import { useKitrMutation } from 'kitr/query'
import { defineMutation } from 'kitr/query'
import { Link } from 'kitr/router'
import { useState } from 'react'
import { api } from '#app/api/client'
import { subscribeSchema } from '#app/features/newsletter/schema'
import { buttonVariants } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { FieldInput, Form, FormField, FormMessage, SubmitButton } from '#components/ui/form'

export const Route = createFileRoute('/')({
  component: HomePage,
})

const subscribe = defineMutation(api.newsletter.subscribe.mutation())

function HomePage() {
  const { t } = useTranslation()
  const features = ['ssr', 'i18n', 'api'] as const
  return (
    <main className="mx-auto max-w-5xl px-4">
      <section className="py-20 text-center">
        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">{t('hero.title')}</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{t('hero.subtitle')}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/blog" className={buttonVariants({ size: 'lg' })}>
            {t('hero.cta')}
          </Link>
          <Link to="/pricing" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
            {t('hero.secondary')}
          </Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {features.map((key) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle>{t('features.' + key + '.title')}</CardTitle>
              <CardDescription>{t('features.' + key + '.body')}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
      <Newsletter />
    </main>
  )
}

function Newsletter() {
  const { t } = useTranslation()
  const mutation = useKitrMutation(subscribe)
  const [done, setDone] = useState(false)
  const form = useSchemaForm(subscribeSchema, { defaultValues: { email: '' } })
  return (
    <section className="mt-16">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>{t('newsletter.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t('newsletter.success')}
            </p>
          ) : (
            <Form
              form={form}
              className="flex flex-col gap-3"
              onSubmit={async (values) => {
                await mutation.mutateAsync({ body: values })
                setDone(true)
              }}
            >
              <FormMessage />
              <FormField name="email" label="Email">
                <FieldInput type="email" placeholder={t('newsletter.placeholder')} autoComplete="email" />
              </FormField>
              <SubmitButton pendingText="…">{t('newsletter.button')}</SubmitButton>
            </Form>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
`,
  )

  write(
    ctx,
    'app/routes/pricing.tsx',
    `import { createFileRoute } from '@tanstack/react-router'
import { seo } from 'kitr/seo'
import { Button } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { PageHeader } from '#components/ui/page-header'

export const Route = createFileRoute('/pricing')({
  head: () => seo({ title: 'Pricing', description: 'Simple plans for every team size.' }),
  component: PricingPage,
})

const tiers = [
  { name: 'Hobby', price: 'Free', features: ['1 project', 'Community support'] },
  { name: 'Team', price: '$29', features: ['Unlimited projects', 'Email support', 'SSO'] },
  { name: 'Enterprise', price: 'Talk to us', features: ['Dedicated support', 'Custom contracts'] },
]

function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <PageHeader title="Pricing" description="Prerendered at build time: this page is static HTML." />
      <div className="grid gap-4 sm:grid-cols-3">
        {tiers.map((tier) => (
          <Card key={tier.name}>
            <CardHeader>
              <CardTitle>{tier.name}</CardTitle>
              <CardDescription className="text-2xl font-semibold text-foreground">{tier.price}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {tier.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Button variant={tier.name === 'Team' ? 'default' : 'outline'}>Choose {tier.name}</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
`,
  )

  write(
    ctx,
    'app/routes/blog/index.tsx',
    `import { createFileRoute } from '@tanstack/react-router'
import { Link } from 'kitr/router'
import { seo } from 'kitr/seo'
import { posts } from '#app/content/posts'
import { PageHeader } from '#components/ui/page-header'

export const Route = createFileRoute('/blog/')({
  head: () => seo({ title: 'Blog', description: 'Notes on building with kitr.' }),
  component: BlogIndexPage,
})

function BlogIndexPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader title="Blog" description="Every post is prerendered; the build crawls these links." />
      <ul className="divide-y divide-border">
        {posts.map((post) => (
          <li key={post.slug} className="py-5">
            <Link to="/blog/$slug" params={{ slug: post.slug }} className="text-lg font-medium hover:underline">
              {post.title}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">{post.excerpt}</p>
            <time dateTime={post.date} className="mt-1 block text-xs text-muted-foreground">
              {new Date(post.date).toLocaleDateString('en-US', { dateStyle: 'medium' })}
            </time>
          </li>
        ))}
      </ul>
    </main>
  )
}
`,
  )

  write(
    ctx,
    'app/routes/blog/$slug.tsx',
    `import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { createFileRoute } from '@tanstack/react-router'
import { Link, notFound } from 'kitr/router'
import { seo } from 'kitr/seo'
import { getPost } from '#app/content/posts'
import { Icon } from '#components/ui/icon'

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => {
    const post = getPost(params.slug)
    if (!post) throw notFound()
    return post
  },
  head: ({ loaderData }) =>
    seo({ title: loaderData?.title, description: loaderData?.excerpt, type: 'article' }),
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">No such post</h1>
      <Link to="/blog" className="mt-4 inline-block underline">
        Back to the blog
      </Link>
    </main>
  ),
  component: PostPage,
})

function PostPage() {
  const post = Route.useLoaderData()
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link
        to="/blog"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <Icon icon={ArrowLeft01Icon} size={14} />
        Blog
      </Link>
      <article className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight">{post.title}</h1>
        <time dateTime={post.date} className="mt-2 block text-sm text-muted-foreground">
          {new Date(post.date).toLocaleDateString('en-US', { dateStyle: 'long' })}
        </time>
        <div className="prose mt-6 space-y-4 text-base leading-7">
          {post.body.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </div>
      </article>
    </main>
  )
}
`,
  )

  write(
    ctx,
    'test/newsletter.test.ts',
    `// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { server } from '#server/main'

describe('newsletter', () => {
  it('subscribes a valid email', async () => {
    const res = await server.fetch(
      new Request('http://app/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reader@example.com' }),
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true })
  })

  it('rejects an invalid email', async () => {
    const res = await server.fetch(
      new Request('http://app/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'nope' }),
      }),
    )
    expect(res.status).toBe(422)
  })
})
`,
  )
}

// ---------------------------------------------------------------------------
// realtime: a chat room over typed channels
// ---------------------------------------------------------------------------

const realtimeExtra = (ctx: ProjectContext, name: string) => {
  const brand = displayName(name)
  remove(ctx, 'app/routes/about.tsx', 'app/channels/example.ts')
  addScript(ctx, 'api:sync', 'kitr api:sync')

  write(
    ctx,
    'app/features/chat/schema.ts',
    `import { z } from 'zod'

export const sendMessageSchema = z.object({
  room: z.string().min(1),
  author: z.string().trim().min(1, 'Pick a name').max(32),
  text: z.string().trim().min(1, 'Say something').max(500),
})
export type SendMessage = z.infer<typeof sendMessageSchema>

export const roomQuerySchema = z.object({ room: z.string().default('general') })

export interface Message {
  id: string
  room: string
  author: string
  text: string
  at: string
}
`,
  )

  write(
    ctx,
    'app/channels/chat.ts',
    `import { defineChannel } from 'kitr/realtime'
import { api } from '#app/api/client'
import type { Message } from '#app/features/chat/schema'

/**
 * One definition for both ends. The server emits \`message\` from MessagesController;
 * the client's \`effects\` refresh the room's query, so the list updates without any wiring in the component.
 */
export const chatChannel = defineChannel<{ room: string }>({
  name: 'chat',
  events: {
    message: {
      effects: (_message: Message, { room }) => ({
        invalidate: [api.messages.index.key({ query: { room } })],
      }),
    },
  },
  authorize: () => true,
})
`,
  )

  write(
    ctx,
    'server/controllers/messages_controller.ts',
    `import type { HttpContext } from 'kitr/api'
import { realtime } from '#server/realtime'
import { chatChannel } from '#app/channels/chat'
import {
  type Message,
  type SendMessage,
  roomQuerySchema,
  sendMessageSchema,
} from '#app/features/chat/schema'
import type { z } from 'zod'

type Ctx<Q = Record<string, string | string[]>, B = unknown> = HttpContext<Record<string, string>, Q, B>

/** Last 100 messages per room, in memory. */
const rooms = new Map<string, Message[]>()
const history = (room: string) => {
  let list = rooms.get(room)
  if (!list) {
    list = [
      {
        id: 'welcome',
        room,
        author: 'kitr',
        text: 'Welcome to #' + room + '. Messages here go over a typed WebSocket channel.',
        at: new Date().toISOString(),
      },
    ]
    rooms.set(room, list)
  }
  return list
}

export default class MessagesController {
  static validation = {
    index: { query: roomQuerySchema },
    store: { body: sendMessageSchema },
  }

  async index({ query }: Ctx<z.infer<typeof roomQuerySchema>>) {
    return history(query.room)
  }

  async store({ body, response }: Ctx<Record<string, string | string[]>, SendMessage>) {
    const message: Message = {
      id: crypto.randomUUID(),
      room: body.room,
      author: body.author,
      text: body.text,
      at: new Date().toISOString(),
    }
    const list = history(body.room)
    list.push(message)
    if (list.length > 100) list.shift()
    realtime.use(chatChannel, { room: body.room }).emit('message', message)
    response.status(201)
    return message
  }
}
`,
  )

  write(
    ctx,
    'server/routes.ts',
    `import { cors, defineRoutes } from 'kitr/api'
import HealthController from '#server/controllers/health_controller'
import MessagesController from '#server/controllers/messages_controller'

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api', middleware: [cors()] }, (api) =>
    api
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .resource('messages', MessagesController, { only: ['index', 'store'] }),
  ),
)

/** Pass to createApiClient<AppRoutes>() on the client. */
export type AppRoutes = typeof routes.$types
`,
  )
  write(
    ctx,
    'app/api/routes.gen.ts',
    routeTable([
      ['health', 'GET', '/api/health'],
      ['messages.index', 'GET', '/api/messages'],
      ['messages.store', 'POST', '/api/messages'],
    ]),
  )
  write(ctx, 'app/api/client.ts', apiClient)

  write(
    ctx,
    'server/realtime.ts',
    `import { createRealtimeServer } from 'kitr/realtime/server'
import { chatChannel } from '#app/channels/chat'

export const realtime = createRealtimeServer({
  channels: [chatChannel],
  // authorize: (request) => verify(request.headers.get('authorization')),
})
`,
  )
  write(
    ctx,
    'server/main.ts',
    `import { mountRoutes } from 'kitr/api'
import { createServer } from 'kitr/server'
import { config } from '../config'
import rc from '../kitrrc'
import { routes } from '#server/routes'
import { realtime } from '#server/realtime'

/** The kitr server behind Start's /api/* catch-all route; also what tests call. Providers from kitrrc.ts, config from config/. */
export const server = createServer({ providers: rc.providers, config })
mountRoutes(server, routes)
// WebSocket upgrades on /api/ws, next to the REST routes.
realtime.attach(server, '/api/ws')
`,
  )
  write(
    ctx,
    'config/realtime.ts',
    `import { defineConfig } from 'kitr/realtime'

export default defineConfig({
  path: '/api/ws',
  transport: 'websocket',
})
`,
  )
  write(
    ctx,
    'app/realtime.ts',
    `import { type SocketTransport, createSocketClient } from 'kitr/realtime'
import realtimeConfig from '#config/realtime'

let transport: SocketTransport | undefined

/** One connection per tab, opened on first use (so nothing connects during SSR). */
export function getSocket(): SocketTransport {
  transport ??= createSocketClient({
    url: () => window.location.origin.replace(/^http/, 'ws') + realtimeConfig.path,
  })
  return transport
}
`,
  )

  write(
    ctx,
    'app/features/chat/queries.ts',
    `import { defineMutation, defineQuery, defineSubscription } from 'kitr/query'
import { channel } from 'kitr/realtime'
import { api } from '#app/api/client'
import { chatChannel } from '#app/channels/chat'
import { getSocket } from '#app/realtime'

export const messagesQuery = defineQuery(api.messages.index.query())

export const sendMessage = defineMutation(
  api.messages.store.mutation({
    // The socket event refreshes the list for everyone, including the sender; nothing to do here.
  }),
)

/** Live events for a room; \`useSubscription(chatSubscription(), { room })\` in a client-only component. */
export const chatSubscription = () => defineSubscription(channel(getSocket(), chatChannel).subscription())
`,
  )

  write(
    ctx,
    'app/storage.ts',
    `import { defineStorage } from 'kitr/storage'

/** The display name, remembered between visits. */
export const displayName = defineStorage('chat:name', { default: '' })
`,
  )

  write(
    ctx,
    'app/routes/__root.tsx',
    startRoot({
      imports: '',
      head: `    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: '${brand}' },
    ],`,
      body: '      <Outlet />',
    }),
  )

  write(
    ctx,
    'app/routes/index.tsx',
    `import { createFileRoute } from '@tanstack/react-router'
import { useKitrMutation, useSubscription, useSuspenseQuery } from 'kitr/query'
import { ssrRoute } from 'kitr/seo'
import { useStorage } from 'kitr/storage/react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { chatSubscription, messagesQuery, sendMessage } from '#app/features/chat/queries'
import { displayName } from '#app/storage'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#components/ui/card'
import { Input } from '#components/ui/input'

const rooms = ['general', 'random', 'help']

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    room: typeof search.room === 'string' && rooms.includes(search.room) ? search.room : 'general',
  }),
  // The socket only exists in the browser, so this page renders on the client.
  ...ssrRoute(false),
  component: ChatPage,
})

function ChatPage() {
  const { room } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">${brand}</h1>
        {rooms.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={r === room ? 'default' : 'outline'}
            onClick={() => navigate({ search: { room: r } })}
          >
            #{r}
          </Button>
        ))}
      </header>
      <Room key={room} room={room} />
    </main>
  )
}

function Room({ room }: { room: string }) {
  const { data: messages } = useSuspenseQuery(messagesQuery.options({ query: { room } }))
  const subscription = useMemo(() => chatSubscription(), [])
  const live = useSubscription(subscription, { room })
  const send = useKitrMutation(sendMessage)
  const [author, setAuthor] = useStorage(displayName)
  const [text, setText] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when the list grows
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!author.trim() || !text.trim()) return
    await send.mutateAsync({ body: { room, author: author.trim(), text: text.trim() } })
    setText('')
  }

  return (
    <Card className="flex flex-1 flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>#{room}</CardTitle>
        <Badge variant={live.status === 'open' ? 'default' : 'secondary'}>
          {live.status === 'open' ? 'live' : live.status}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <ol className="flex max-h-[60vh] flex-1 flex-col gap-2 overflow-y-auto text-sm">
          {messages.map((message) => (
            <li key={message.id} className="rounded-md bg-muted/50 px-3 py-2">
              <span className="font-medium">{message.author}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {new Date(message.at).toLocaleTimeString()}
              </span>
              <p className="mt-0.5 whitespace-pre-wrap">{message.text}</p>
            </li>
          ))}
          <div ref={bottom} />
        </ol>
        <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
          <Input
            aria-label="Your name"
            placeholder="Your name"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <Input
            aria-label="Message"
            placeholder={'Message #' + room}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" disabled={send.isPending || !author.trim() || !text.trim()}>
            Send
          </Button>
        </form>
        {send.error ? <p className="text-sm text-destructive">{send.error.message}</p> : null}
      </CardContent>
    </Card>
  )
}
`,
  )

  write(
    ctx,
    'test/messages.test.ts',
    `// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { server } from '#server/main'

describe('messages', () => {
  it('stores a message and lists it for the room', async () => {
    const post = await server.fetch(
      new Request('http://app/api/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room: 'tests', author: 'vitest', text: 'hello' }),
      }),
    )
    expect(post.status).toBe(201)
    const list = await server.fetch(new Request('http://app/api/messages?room=tests'))
    const messages = (await list.json()) as Array<{ text: string }>
    expect(messages.at(-1)?.text).toBe('hello')
  })

  it('rejects empty messages', async () => {
    const res = await server.fetch(
      new Request('http://app/api/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room: 'tests', author: 'vitest', text: '  ' }),
      }),
    )
    expect(res.status).toBe(422)
  })
})
`,
  )
}

// ---------------------------------------------------------------------------
// desktop: the app kit inside Electron
// ---------------------------------------------------------------------------

const desktopExtra = (ctx: ProjectContext, name: string) => {
  const brand = displayName(name)
  write(
    ctx,
    'app/routes/index.tsx',
    `import { createFileRoute } from '@tanstack/react-router'
import { isElectron } from 'kitr/desktop/client'
import { useEffect, useState } from 'react'
import { ipc } from '#app/ipc'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { PageHeader } from '#components/ui/page-header'

export const Route = createFileRoute('/')({
  component: HomePage,
})

/**
 * The same page runs in the browser (\`kitr dev site\`) and in Electron (\`kitr dev app\`).
 * \`ipc.available\` tells them apart; every call goes through the typed contract in platforms/app/ipc.ts.
 */
function HomePage() {
  const [version, setVersion] = useState<string>()
  const [file, setFile] = useState<string | null>(null)
  const [focused, setFocused] = useState(true)

  useEffect(() => {
    if (!ipc.available) return
    void ipc.invoke('app.version').then(setVersion)
    return ipc.on('app.focus', setFocused)
  }, [])

  return (
    <main className="mx-auto max-w-2xl p-6">
      <PageHeader
        title="${brand}"
        description="A kitr app with an Electron shell. The window loads the same client build the web platform ships."
        actions={
          <Badge variant={ipc.available ? 'default' : 'secondary'}>
            {ipc.available ? 'Electron ' + (version ?? '…') : isElectron() ? 'Electron (no bridge)' : 'Browser'}
          </Badge>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Native dialogs</CardTitle>
            <CardDescription>\`ipc.invoke('dialog.openFile')\` runs in the main process.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              disabled={!ipc.available}
              onClick={async () => setFile(await ipc.invoke('dialog.openFile', [{ name: 'Text', extensions: ['txt', 'md'] }]))}
            >
              Open a file…
            </Button>
            <p className="break-all text-sm text-muted-foreground">
              {ipc.available ? (file ?? 'No file chosen.') : 'Available inside Electron.'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Push events</CardTitle>
            <CardDescription>Main pushes \`app.focus\` whenever the window focus changes.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {ipc.available ? (focused ? 'Window is focused.' : 'Window is in the background.') : 'Available inside Electron.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
`,
  )
}

// ---------------------------------------------------------------------------
// tauri: the app kit in a Tauri shell with typed Rust commands
// ---------------------------------------------------------------------------

const tauriExtra = (ctx: ProjectContext, name: string) => {
  const brand = displayName(name)
  write(
    ctx,
    'app/routes/index.tsx',
    `import { createFileRoute } from '@tanstack/react-router'
import { isTauri, useTauriEvent } from 'kitr/tauri/client'
import { useCallback, useState } from 'react'
import { commands } from '#app/commands'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { Input } from '#components/ui/input'
import { PageHeader } from '#components/ui/page-header'

export const Route = createFileRoute('/')({
  component: HomePage,
})

/**
 * The same page runs in the browser (\`kitr dev site\`) and in the Tauri window (\`kitr dev app\`).
 * \`isTauri()\` tells them apart; every call goes through the typed commands in app/commands.ts,
 * which mirror the \`#[tauri::command]\` functions in platforms/app/src-tauri/src/lib.rs.
 */
function HomePage() {
  const native = isTauri()
  const [name, setName] = useState('kitr')
  const [greeting, setGreeting] = useState<string>()
  const [lastEvent, setLastEvent] = useState<string>()
  useTauriEvent<string>(
    'hello',
    useCallback((payload: string) => setLastEvent(payload), []),
  )

  return (
    <main className="mx-auto max-w-2xl p-6">
      <PageHeader
        title="${brand}"
        description="A kitr app with a Tauri shell. The window loads the same client build the web platform ships."
        actions={<Badge variant={native ? 'default' : 'secondary'}>{native ? 'Tauri' : 'Browser'}</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rust commands</CardTitle>
            <CardDescription>\`commands.greet({ name })\` runs in src-tauri/src/lib.rs.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!native} />
            <Button disabled={!native} onClick={async () => setGreeting(await commands.greet({ name }))}>
              Greet
            </Button>
            <p className="text-sm text-muted-foreground">
              {native ? (greeting ?? 'No greeting yet.') : 'Available inside the Tauri window.'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>Rust emits \`hello\` (\`app.emit("hello", payload)\`); the page listens with \`useTauriEvent\`.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {native ? (lastEvent ?? 'No event received yet.') : 'Available inside the Tauri window.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
`,
  )
}

// ---------------------------------------------------------------------------
// mobile: the app kit as a PWA and a Capacitor shell
// ---------------------------------------------------------------------------

const mobileExtra = (ctx: ProjectContext, name: string) => {
  const brand = displayName(name)
  write(
    ctx,
    'app/routes/__root.tsx',
    `import type { KitrRouterContext } from 'kitr/router'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from 'kitr/router'
import type { ReactNode } from 'react'
import css from '#app/styles/app.css?url'
import { PwaUpdate } from '#app/components/pwa-update'

export const Route = createRootRouteWithContext<KitrRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
    ],
    links: [{ rel: 'stylesheet', href: css }, { rel: 'manifest', href: '/manifest.webmanifest' }],
  }),
  component: RootLayout,
})

function RootLayout() {
  return (
    <RootDocument>
      <Outlet />
      <PwaUpdate />
    </RootDocument>
  )
}

/** The HTML shell: one page for the browser, the installed PWA and the Capacitor WebView. */
function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
`,
  )
  write(
    ctx,
    'app/components/pwa-update.tsx',
    `import { useServiceWorker } from 'kitr/web/client'

/** Registers the service worker and shows a one-line banner when a new version is waiting. */
export function PwaUpdate() {
  const sw = useServiceWorker()
  if (!sw.needRefresh) return null
  return (
    <div role="status" className="fixed bottom-4 right-4 rounded-md bg-foreground px-3 py-2 text-sm text-background shadow">
      A new version is available.{' '}
      <button type="button" className="underline" onClick={() => sw.update()}>
        Reload
      </button>
    </div>
  )
}
`,
  )
  write(
    ctx,
    'app/routes/index.tsx',
    `import { createFileRoute } from '@tanstack/react-router'
import { useAppState, useBackButton, useOnline, usePlatform } from 'kitr/platform/react'
import { useInstallPrompt } from 'kitr/web/client'
import { useCallback, useState } from 'react'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { PageHeader } from '#components/ui/page-header'

export const Route = createFileRoute('/')({
  component: HomePage,
})

/**
 * One page, three homes: the browser, the installed PWA, and the Capacitor shell on iOS/Android.
 * Everything below works in all three; \`kitr/platform\` answers the same way everywhere.
 */
function HomePage() {
  const platform = usePlatform()
  const online = useOnline()
  const install = useInstallPrompt()
  const active = useAppState()
  const [backPresses, setBackPresses] = useState(0)
  useBackButton(useCallback(() => setBackPresses((n) => n + 1), []))

  return (
    <main className="mx-auto max-w-lg p-4 pb-[env(safe-area-inset-bottom)]">
      <PageHeader
        title="${brand}"
        description="Platform-aware without user-agent sniffing."
        actions={<Badge variant="secondary">{platform.type} · {platform.os}</Badge>}
      />
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Connectivity</CardTitle>
            <CardDescription>\`useOnline()\` tracks the online and offline events.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={online ? 'default' : 'destructive'}>{online ? 'Online' : 'Offline'}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Install</CardTitle>
            <CardDescription>
              The manifest and service worker come from the web platform's pwa option in kitrrc.ts; \`useInstallPrompt()\` wraps the browser prompt.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Button disabled={!install.canInstall} onClick={() => install.install()}>
              Add to home screen
            </Button>
            <span className="text-sm text-muted-foreground">
              {install.installed
                ? 'Installed.'
                : install.canInstall
                  ? 'Ready to install.'
                  : platform.native
                    ? 'Running inside the native shell.'
                    : 'Open in a browser that supports installation.'}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Native lifecycle</CardTitle>
            <CardDescription>Only wired up inside Capacitor; harmless on the web.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            <p>App state: {active ? 'active' : 'background'}</p>
            <p>Hardware back button presses: {backPresses}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
`,
  )
}

function displayName(name: string) {
  return name
    .replace(/^@[^/]+\//, '')
    .replace(/^example-/, '')
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
}

const appComponents = [
  'icon',
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
  'badge',
]

export const presetKits: Record<
  'saas' | 'site' | 'realtime' | 'desktop' | 'tauri' | 'mobile',
  Kit
> = {
  saas: {
    name: 'saas',
    description:
      'A logged-in product on its own API: sign-in, a guarded app shell, a projects CRUD with a data table, analytics and monitoring. Server-rendered web plus an API server.',
    platforms: { site: { type: 'web', options: { mode: 'ssr' } }, api: { type: 'server' } },
    packages: [
      'http',
      'forms',
      'table',
      'state',
      'tailwind',
      'theme',
      'auth',
      'storage',
      'testing',
      'devtools',
      'seo',
      'api',
      'analytics',
      'monitoring',
    ],
    components: [...appComponents, 'dialog', 'skeleton'],
    base: baseReact,
    extra: saasExtra,
  },
  site: {
    name: 'site',
    description:
      'A marketing site: server-rendered with prerendering, SEO heads, i18n (en/de), a blog and a newsletter form on a controller.',
    platforms: { site: { type: 'web', options: { mode: 'ssr' } }, api: { type: 'server' } },
    packages: [
      'query',
      'forms',
      'tailwind',
      'theme',
      'i18n',
      'storage',
      'analytics',
      'testing',
      'devtools',
      'seo',
      'api',
    ],
    components: ['icon', 'button', 'input', 'label', 'card', 'form', 'page-header', 'theme-toggle'],
    base: baseReact,
    extra: siteExtra,
  },
  realtime: {
    name: 'realtime',
    description:
      'A chat room: typed WebSocket channels that feed the query cache, a messages controller, rooms in the URL.',
    platforms: { site: { type: 'web', options: { mode: 'ssr' } }, api: { type: 'server' } },
    packages: [
      'query',
      'forms',
      'tailwind',
      'theme',
      'storage',
      'testing',
      'devtools',
      'seo',
      'api',
      'realtime',
    ],
    components: ['button', 'input', 'label', 'card', 'badge', 'page-header'],
    base: baseReact,
    extra: realtimeExtra,
  },
  desktop: {
    name: 'desktop',
    description:
      'The app kit in an Electron shell with a typed IPC contract and native dialogs. See the tauri kit for a Tauri shell.',
    platforms: {
      site: { type: 'web', options: { mode: 'spa' } },
      app: { type: 'desktop' },
    },
    packages: [
      'http',
      'forms',
      'table',
      'state',
      'tailwind',
      'theme',
      'auth',
      'storage',
      'mocks',
      'testing',
      'devtools',
      'platform',
    ],
    components: appComponents,
    base: baseReact,
    extra: desktopExtra,
  },
  tauri: {
    name: 'tauri',
    description:
      'The app kit in a Tauri shell: typed Rust commands and events from the same React app. See the desktop kit for Electron.',
    platforms: {
      site: { type: 'web', options: { mode: 'spa' } },
      app: { type: 'tauri' },
    },
    packages: [
      'http',
      'forms',
      'table',
      'state',
      'tailwind',
      'theme',
      'auth',
      'storage',
      'mocks',
      'testing',
      'devtools',
      'platform',
    ],
    components: appComponents,
    base: baseReact,
    extra: tauriExtra,
  },
  mobile: {
    name: 'mobile',
    description:
      'The app kit as an installable PWA and a Capacitor shell: online state, install prompt, native lifecycle hooks.',
    platforms: {
      site: { type: 'web', options: { mode: 'spa', pwa: true } },
      phone: { type: 'mobile' },
    },
    packages: [
      'http',
      'forms',
      'table',
      'state',
      'tailwind',
      'theme',
      'auth',
      'storage',
      'mocks',
      'testing',
      'devtools',
      'platform',
    ],
    components: appComponents,
    base: baseReact,
    extra: mobileExtra,
  },
}
