import { type AddContext, definePackage } from '@kitr/core/package'

const write = (ctx: AddContext, path: string, content: string) =>
  ctx.write(path, content, { overwrite: true })

const remove = (ctx: AddContext, ...paths: string[]) => {
  for (const p of paths) ctx.unlink(p)
}

const addScript = (ctx: AddContext, name: string, command: string) => ctx.scripts.add(name, command)

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
import { ThemeScript } from 'kitr/theme'
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
        <ThemeScript />
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

function displayName(name: string) {
  return name
    .replace(/^@[^/]+\//, '')
    .replace(/^example-/, '')
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
}

const apiClient = `import { createApiClient, registerRoutes } from 'kitr/api/client'
import type { AppRoutes } from '#server/routes'
import { routeTable } from './routes.gen'

/** Typed, no codegen: route names, params, bodies and outputs come from the router. */
export const api = createApiClient<AppRoutes>({
  baseUrl: typeof window === 'undefined' ? 'http://localhost:' + (process.env.PORT ?? 3000) : '',
})
registerRoutes(api, [...routeTable])
`

const files = (ctx: AddContext, name: string) => {
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
    `import { defineRoutes } from 'kitr/api'
import AuthController from '#server/controllers/auth_controller'
import HealthController from '#server/controllers/health_controller'
import ProjectsController from '#server/controllers/projects_controller'

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api' }, (api) =>
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
    return requireAuth()({ context: { session, app: context.app }, location })
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
      <DataTable columns={columns} data={data} clientSide {...tableState} />
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

/**
 * `kitr new --kit saas`: A logged-in product on its own API: sign-in, a guarded app shell, a projects CRUD with a data table, analytics and monitoring. Server-rendered web plus an API server.
 */
export default definePackage({
  name: 'saas',
  kind: 'kit',
  kit: {
    description:
      'A logged-in product on its own API: sign-in, a guarded app shell, a projects CRUD with a data table, analytics and monitoring. Server-rendered web plus an API server.',
    platforms: {
      site: {
        type: 'web',
        options: {
          mode: 'ssr',
        },
      },
      api: {
        type: 'server',
      },
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
      'testing',
      'devtools',
      'seo',
      'api',
      'analytics',
      'monitoring',
    ],
    components: [
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
      'dialog',
      'skeleton',
    ],
    files,
  },
})
