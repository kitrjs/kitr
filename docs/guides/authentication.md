---
title: Add sign-in, end to end
description: Users, password sign-in, cookie sessions, guarded pages, sessions in server actions and API routes, and permissions checked the same way in the browser and on the server.
packages: auth, actions, api, db, router, forms
platforms: web, server
time: 50 min
---

# Add sign-in, end to end

Sign-in touches every layer of an app at once: a table of users, a sign-in endpoint, a cookie, a guard on the pages, a check in every server action and API route, and buttons that only some people should see. Each piece is small. The work is making them agree, so that the rule that hides the Edit button is the same rule the server enforces.

This guide adds that to `acme-projects`, the app from [Build a full-stack app](/guides/fullstack-app). Ada (an admin) and Grace (a member) sign in with an email and password, the session lives in an HTTP-only cookie, every page under `/projects` needs a signed-in user, server actions read the user's team from the session instead of trusting the browser, and members can only rename the projects they own.

## Before you start

You need the project from [Build a full-stack app](/guides/fullstack-app), with its Postgres database and Drizzle schema. The `fullstack` kit already includes [Auth](/packages/auth): `config/auth.ts`, `app/abilities.ts` and the session in the router context exist. In another project, run `kitr add auth` first.

[Auth](/packages/auth) ships the server pieces (`createCookieSession`, `hashPassword`, a `UserProvider` interface and `createSessionController` in `@kitr/auth/server`; the `saas` kit uses them as they come). This guide writes the same few endpoints by hand, in your own API, so you can see every moving part; swap in the shipped pieces once you have. To use a hosted provider or [Better Auth](https://www.better-auth.com/docs) instead, swap the adapter in "Connect the browser to the session"; everything after that section stays the same.

## Store users and sessions

Add two tables next to `projects`. A session is a random id the server can look up and delete, so signing out really ends it:

```ts
// server/db/schema.ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'member'] }).notNull(),
  teamId: text('team_id').notNull(),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
})

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  teamId: text('team_id').notNull(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Project = typeof projects.$inferSelect
```

`projects` gains an `ownerId`, which the permission rules use later. Generate and apply the migration:

```sh
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

## Hash passwords

Never store a password, only a slow hash of it. Node's built-in [scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback) is enough, with no dependency:

```ts
// server/auth/passwords.ts
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 64)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = await scryptAsync(password, Buffer.from(salt, 'hex'), 64)
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'))
}
```

`timingSafeEqual` compares in constant time, so an attacker cannot learn how much of a hash matched from how long the answer took.

Seed Ada and Grace so there is someone to sign in as:

```ts
// server/db/seed.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { hashPassword } from '#server/auth/passwords'
import { users } from '#server/db/schema'

const db = drizzle(postgres(process.env.DATABASE_URL!))
const passwordHash = await hashPassword('correct horse battery')

await db
  .insert(users)
  .values([
    { id: 'u_ada', email: 'ada@acme.com', passwordHash, role: 'admin', teamId: 'team_acme' },
    { id: 'u_grace', email: 'grace@acme.com', passwordHash, role: 'member', teamId: 'team_acme' },
  ])
  .onConflictDoNothing()
await db.$client.end()
```

```sh
pnpm tsx --env-file=.env server/db/seed.ts
```

## Create and look up sessions

Keep everything that touches the session cookie in one module, so the API, the actions and the tests all read it the same way:

```ts
// server/auth/sessions.ts
import { randomBytes } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { useDb } from '@kitr/db'
import { useRequestApp } from '@kitr/server'
import type { User } from '#app/abilities'
import type { AppDb } from '#config/db'
import { sessions, users } from '#server/db/schema'

export const SESSION_COOKIE = 'acme_session'
const THIRTY_DAYS = 30 * 24 * 60 * 60

const db = () => useDb<AppDb>(useRequestApp())

export async function startSession(userId: string): Promise<string> {
  const id = randomBytes(32).toString('base64url')
  await db().insert(sessions).values({ id, userId, expiresAt: new Date(Date.now() + THIRTY_DAYS * 1000) })
  return id
}

export async function endSession(id: string): Promise<void> {
  await db().delete(sessions).where(eq(sessions.id, id))
}

export async function findUserBySession(id: string): Promise<User | null> {
  const [row] = await db()
    .select({ id: users.id, email: users.email, role: users.role, teamId: users.teamId })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
  return row ?? null
}

export function sessionCookie(id: string, maxAge = THIRTY_DAYS): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export function sessionIdFrom(request: Request): string | null {
  const cookies = request.headers.get('cookie') ?? ''
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))
  return match ? decodeURIComponent(match[1]!) : null
}
```

What each cookie attribute does:

| Attribute | Effect |
| --- | --- |
| `HttpOnly` | Scripts on the page cannot read the cookie, so a cross-site scripting bug cannot steal the session. |
| `SameSite=Lax` | The browser does not send the cookie on form posts and `fetch` calls from other sites, which blocks cross-site request forgery on writes. |
| `Secure` | Only sent over HTTPS. Set in production; `localhost` is plain HTTP in development. |
| `Max-Age` | How long the browser keeps it. The `expiresAt` row is what the server trusts. |

Update `app/abilities.ts` so `User` matches the columns, and `Project` has an owner:

```ts
// app/abilities.ts
import { defineAbilities } from '@kitr/auth'

export interface User {
  id: string
  email: string
  role: 'admin' | 'member'
  teamId: string
}

export interface Project {
  id: string
  ownerId: string
  teamId: string
}

export const abilities = defineAbilities({
  'projects.view': (user: User, project: Project) => project.teamId === user.teamId,
  'projects.update': (user: User, project: Project) => user.role === 'admin' || project.ownerId === user.id,
  'teams.invite': (user: User) => user.role === 'admin',
})
```

## Add the sign-in endpoints

Three routes are enough: start a session, read it, end it. Put them in a controller:

```ts
// server/controllers/session-controller.ts
import { eq } from 'drizzle-orm'
import type { HttpContext } from '@kitr/api'
import { KitrError } from '@kitr/kitr/app'
import { currentUser } from '@kitr/auth/server'
import { useDb } from '@kitr/db'
import { z } from 'zod'
import type { User } from '#app/abilities'
import type { AppDb } from '#config/db'
import { verifyPassword } from '#server/auth/passwords'
import { endSession, sessionCookie, sessionIdFrom, startSession } from '#server/auth/sessions'
import { users } from '#server/db/schema'

const credentials = z.object({ email: z.string().email(), password: z.string().min(1) })

export default class SessionController {
  static validation = { store: { body: credentials } }

  async show(ctx: HttpContext) {
    return { user: currentUser<User>(ctx) }
  }

  async store({ app, body, response }: HttpContext<{}, {}, z.output<typeof credentials>>) {
    const [user] = await useDb<AppDb>(app).select().from(users).where(eq(users.email, body.email.toLowerCase()))
    if (!user || !(await verifyPassword(body.password, user.passwordHash)))
      throw KitrError.unauthorized('Wrong email or password')
    response.header('set-cookie', sessionCookie(await startSession(user.id)))
    return { user: { id: user.id, email: user.email, role: user.role, teamId: user.teamId } }
  }

  async destroy({ request, response }: HttpContext) {
    const id = sessionIdFrom(request.native)
    if (id) await endSession(id)
    response.header('set-cookie', sessionCookie('', 0))
    return response.noContent()
  }
}
```

The same message for an unknown email and a wrong password is deliberate: a different answer would tell an attacker which emails have accounts.

Register the routes, and read the cookie on every API request with `authMiddleware` from `@kitr/auth/server`:

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'
import { authMiddleware, can } from '@kitr/auth/server'
import { abilities, type User } from '#app/abilities'
import { findUserBySession, SESSION_COOKIE } from '#server/auth/sessions'
import ProjectsController from '#server/controllers/projects-controller'
import SessionController from '#server/controllers/session-controller'
import { findProject } from '#server/services/projects'

const optionalAuth = authMiddleware<User>({
  from: { cookie: SESSION_COOKIE },
  optional: true,
  verify: (id) => findUserBySession(id),
  abilities,
})
const auth = authMiddleware<User>({ from: { cookie: SESSION_COOKIE }, verify: (id) => findUserBySession(id), abilities })

export const routes = defineRoutes([api], (router) =>
  router.group('/api', (r) =>
    r
      .get('/health', () => ({ ok: true }), { name: 'health' })
      .group({ middleware: [optionalAuth] }, (open) =>
        open
          .get('/session', [SessionController, 'show'], { name: 'session.show' })
          .post('/session', [SessionController, 'store'], { name: 'session.store' })
          .delete('/session', [SessionController, 'destroy'], { name: 'session.destroy' }),
      )
      .group({ middleware: [auth] }, (secured) =>
        secured
          .get('/projects', [ProjectsController, 'index'], { name: 'projects.index' })
          .patch('/projects/:id', [ProjectsController, 'update'], {
            name: 'projects.update',
            middleware: [can('projects.update', (ctx) => findProject(ctx.params.id))],
          }),
      ),
  ),
)

export type ServerRoutes = typeof routes.$types
```

`can('projects.update', loader)` loads the project before it checks the rule. The loader is a plain function:

```ts
// server/services/projects.ts
import { eq } from 'drizzle-orm'
import { useDb } from '@kitr/db'
import { useRequestApp } from '@kitr/server'
import type { AppDb } from '#config/db'
import { projects } from '#server/db/schema'

export async function findProject(id: string) {
  const [project] = await useDb<AppDb>(useRequestApp()).select().from(projects).where(eq(projects.id, id))
  return project ?? null
}
```

Try it from a terminal:

```sh
curl -i -X POST localhost:3000/api/session -H 'content-type: application/json' \
  -d '{"email":"grace@acme.com","password":"correct horse battery"}'
```

```txt
HTTP/1.1 200 OK
set-cookie: acme_session=Yp3...; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000

{"user":{"id":"u_grace","email":"grace@acme.com","role":"member","teamId":"team_acme"}}
```

`GET /api/projects` without the cookie answers `401` with `{"code":"UNAUTHORIZED","message":"Authentication required","status":401}`. Grace renaming one of Ada's projects through `PATCH /api/projects/:id` answers `403` with `Missing permission "projects.update"`, before the controller runs.

## Connect the browser to the session

The browser side of [Auth](/packages/auth) asks an adapter for the session. With a cookie the browser sends on its own, `customAdapter` only needs to call the three routes:

```ts
// config/auth.ts
import { createSession, customAdapter, defineConfig } from '@kitr/auth'
import { KitrError } from '@kitr/kitr/app'
import { abilities, type User } from '#app/abilities'

type Credentials = { email: string; password: string }

const adapter = customAdapter<User, Credentials>({
  async getSession() {
    const res = await fetch('/api/session', { credentials: 'same-origin' })
    const { user } = (await res.json()) as { user: User | null }
    return user ? createSession(user, abilities) : null
  },
  async signIn(credentials) {
    const res = await fetch('/api/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    })
    if (!res.ok) throw KitrError.unauthorized('Wrong email or password')
    const { user } = (await res.json()) as { user: User }
    return createSession(user, abilities)
  },
  async signOut() {
    await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' })
  },
})

export default defineConfig({ adapter, signInPath: '/sign-in' })
```

The pages and the API share an origin, because `app/server.ts` serves the paths of `server/routes.ts` from the site's process, so the relative URL works and the cookie goes along. No token is stored anywhere a script can read.

## Build the sign-in page

The page validates the form, calls `auth.signIn` and goes back to where the visitor was headed:

```ts
// app/routes.ts
r.page('/sign-in', {
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  lazy: () => import('./pages/sign-in'),
})
```

```tsx
// app/pages/sign-in.tsx
import { useAuth } from '@kitr/auth'
import { FieldInput, Form, FormField, SubmitButton, useSchemaForm } from '@kitr/forms'
import { getRouteApi, useNavigate } from '@kitr/router'
import { z } from 'zod'
import type { User } from '#app/abilities'

const route = getRouteApi('/sign-in')

const schema = z.object({
  email: z.string().email('Enter your work email'),
  password: z.string().min(1, 'Enter your password'),
})

export default function SignInPage() {
  const { redirect } = route.useSearch()
  const navigate = useNavigate()
  const auth = useAuth<User, z.output<typeof schema>>()
  const form = useSchemaForm(schema, { defaultValues: { email: '', password: '' } })

  return (
    <main className="mx-auto grid max-w-sm gap-4 p-6">
      <h1 className="text-2xl font-semibold">Sign in to Acme</h1>
      <Form
        form={form}
        onSubmit={async (values) => {
          await auth.signIn(values)
          await navigate({ to: redirect ?? '/projects' })
        }}
        className="grid gap-3"
      >
        <FormField name="email" label="Email">
          <FieldInput type="email" autoComplete="email" placeholder="ada@acme.com" />
        </FormField>
        <FormField name="password" label="Password">
          <FieldInput type="password" autoComplete="current-password" />
        </FormField>
        <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
      </Form>
    </main>
  )
}
```

A wrong password shows "Wrong email or password" at the top of the form: `<Form>` displays the `KitrError` the adapter threw. Only redirect to paths inside your app; `redirect` comes from the URL, so check it starts with `/` if you ever accept it from other places.

## Protect the pages

Move the pages that need a user under a pathless layout, `_app`, and guard it once:

```ts
// app/routes.ts
import type { Session } from '@kitr/auth'
import { requireAuth } from '@kitr/router'
import { ssrRoute } from '@kitr/seo'
import type { User } from '#app/abilities'

r.layout('_app', {
  ...ssrRoute(false),
  beforeLoad: async ({ context, location }) => {
    await context.app.boot()
    const session = context.app.container.use('auth').session as Session<User>
    return requireAuth()({ context: { session }, location })
  },
}, (app) => app.page('/projects', { lazy: () => import('./pages/projects') }))
```

```ts
// app/routes.ts
export const routes = defineRoutes([router], (r) =>
  r
    .root({ head, component: RootDocument })
    .page('/', { lazy: () => import('./pages/home') })
    .page('/sign-in', { /* ...as above */ })
    .layout('_app', { /* the guard, as above */ }, (app) =>
      app.page('/projects', { lazy: () => import('./pages/projects') }), // still answers /projects
    ),
)
```

An anonymous visitor to `/projects` lands on `/sign-in?redirect=/projects`. `ssrRoute(false)` renders the guarded pages in the browser: the server renders the shell, then the browser restores the session from the cookie and runs the guard. That keeps signed-in pages out of shared caches, and it means the guard and the session always run in the same place.

The guard is a convenience for the visitor, not security: the data behind the page is protected by the action and API checks below.

## Read the session in server actions

A server action is an HTTP endpoint like any other, so it checks the session itself. Write one middleware that reads the cookie from the request, and use it with `requireSession`:

```ts
// app/actions/middleware/session.ts
import { getRequest } from '@tanstack/react-start/server'
import { createMiddleware } from '@kitr/actions'
import { findUserBySession, sessionIdFrom } from '#server/auth/sessions'

export const sessionMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const id = sessionIdFrom(getRequest())
  const user = id ? await findUserBySession(id) : null
  return next({ context: { session: user ? { user } : null } })
})
```

Now the action takes the team from the session, not from the browser. Before, `projects.list` accepted any `teamId`, so anyone could read another team's projects by changing one string:

```ts
// app/actions/projects/list.ts
import { desc, eq } from 'drizzle-orm'
import { defineQuery, requireSession } from '@kitr/actions'
import { useDb } from '@kitr/db'
import { useRequestApp } from '@kitr/server'
import { sessionMiddleware } from '#app/actions/middleware/session'
import type { AppDb } from '#config/db'
import { projects } from '#server/db/schema'

export const listProjects = defineQuery('projects.list', {
  middleware: [sessionMiddleware, requireSession],
  handler: ({ context }) =>
    useDb<AppDb>(useRequestApp())
      .select()
      .from(projects)
      .where(eq(projects.teamId, context.session.user.teamId))
      .orderBy(desc(projects.createdAt)),
})
```

The page calls it with no input: `useSuspenseQuery('projects.list')`. Called without a session cookie, the action rejects with `UNAUTHORIZED`, and the query shows its error state.

Mutations check permissions the same way. Load the row, then ask the same `abilities` the browser uses:

```ts
// app/actions/projects/rename.ts
import { eq } from 'drizzle-orm'
import { defineMutation, requireSession } from '@kitr/actions'
import { KitrError } from '@kitr/kitr/app'
import { useDb } from '@kitr/db'
import { useRequestApp } from '@kitr/server'
import { z } from 'zod'
import { abilities } from '#app/abilities'
import { sessionMiddleware } from '#app/actions/middleware/session'
import type { AppDb } from '#config/db'
import { projects } from '#server/db/schema'

export const renameProject = defineMutation('projects.rename', {
  middleware: [sessionMiddleware, requireSession],
  input: z.object({ id: z.string(), name: z.string().trim().min(2) }),
  effects: { invalidate: [['action', 'projects.list']] },
  handler: async ({ input, context }) => {
    const db = useDb<AppDb>(useRequestApp())
    const [project] = await db.select().from(projects).where(eq(projects.id, input.id))
    if (!project || !abilities.can(context.session.user, 'projects.view', project)) throw KitrError.notFound('Project')
    if (!abilities.can(context.session.user, 'projects.update', project)) throw KitrError.forbidden()
    const [renamed] = await db.update(projects).set({ name: input.name }).where(eq(projects.id, input.id)).returning()
    return renamed!
  },
})
```

A project in another team answers "not found", not "forbidden": the caller should not learn that it exists.

## Show only what the user can do

In components, `useCan()` asks the same rules for the signed-in user. Hide the actions a user cannot take:

```tsx
// app/components/projects/project-row.tsx
import { useCan } from '@kitr/auth'
import type { Project } from '#server/db/schema'

export function ProjectRow({ project, onRename }: { project: Project; onRename: () => void }) {
  const can = useCan()
  return (
    <li className="flex items-center justify-between">
      {project.name}
      {can('projects.update', project) && (
        <button type="button" onClick={onRename}>
          Rename
        </button>
      )}
    </li>
  )
}
```

Grace sees Rename on her own projects; Ada sees it on every project. If Grace calls `projects.rename` on Ada's project anyway, from the console, the action answers `FORBIDDEN`. One rule, enforced in both places, written once in `app/abilities.ts`.

Show who is signed in, with a way out, in the layout:

```tsx
// app/components/account-menu.tsx
import { useAuth, useUser } from '@kitr/auth'
import { useNavigate } from '@kitr/router'
import type { User } from '#app/abilities'

export function AccountMenu() {
  const auth = useAuth()
  const user = useUser<User>()
  const navigate = useNavigate()
  if (!user) return null
  return (
    <button
      type="button"
      onClick={async () => {
        await auth.signOut()
        await navigate({ to: '/sign-in' })
      }}
    >
      Sign out {user.email}
    </button>
  )
}
```

Signing out deletes the session row, so the cookie stops working everywhere, not only in this tab.

## Test it

Test the rules, the sign-in route and the guard on an action. The API test signs in through the real route and reuses the cookie:

```ts
// @vitest-environment node
// test/sign-in.test.ts
import { createTestClient } from '@kitr/testing'
import { describe, expect, it } from 'vitest'
import { server } from '#server/main'

const client = createTestClient(server)

async function signIn(email: string) {
  const res = await client.post('/api/session', { email, password: 'correct horse battery' })
  const cookie = res.headers.get('set-cookie')?.split(';')[0]
  return createTestClient(server, { headers: { cookie: cookie ?? '' } })
}

describe('sign-in', () => {
  it('rejects a wrong password with the same message as an unknown email', async () => {
    const wrong = await client.post('/api/session', { email: 'grace@acme.com', password: 'nope' })
    const unknown = await client.post('/api/session', { email: 'linus@acme.com', password: 'nope' })
    expect(wrong.body).toEqual(unknown.body)
    expect(wrong.status).toBe(401)
  })

  it('keeps members out of other people’s projects', async () => {
    const grace = await signIn('grace@acme.com')
    const res = await grace.patch('/api/projects/prj_ada_roadmap', { name: 'Mine now' })
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ code: 'FORBIDDEN' })
  })
})
```

Server actions run without middleware in tests, so pass the session as context:

```ts
// app/actions/projects/rename.test.ts
import { runWithApp } from '@kitr/server'
import { beforeAll, expect, it } from 'vitest'
import { renameProject } from '#app/actions/projects/rename'
import { app } from '#app/app'

beforeAll(() => app.boot())

const grace = { id: 'u_grace', email: 'grace@acme.com', role: 'member' as const, teamId: 'team_acme' }

it('refuses to rename a project Grace does not own', async () => {
  await expect(
    runWithApp(app, () =>
      renameProject.run({ id: 'prj_ada_roadmap', name: 'Mine now' }, { context: { session: { user: grace } } }),
    ),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
```

Both tests expect a project `prj_ada_roadmap` owned by Ada in the test database; create it in a `beforeEach`. [Test your app](/guides/testing) sets up that database and the seed.

## Before you go to production

- Rate-limit `POST /api/session`, so nobody can try passwords as fast as your server answers. `rateLimit({ max: 10 })` from `@kitr/api` on that route allows ten attempts a minute per IP.
- Serve over HTTPS only. The cookie is `Secure` in production and the browser will not send it over plain HTTP.
- Delete expired sessions on a schedule, such as a nightly `delete from sessions where expires_at < now()`.
- Let users reset a forgotten password. That needs an email: [Mail](/packages/mail) sends it, with a single-use token stored like a session.

## Next steps

- [Auth](/packages/auth): adapters, token sessions, refresh, and every hook and guard.
- [Actions](/packages/actions): middleware and errors in server actions.
- [API routes](/packages/api): route groups, middleware and rate limits.
- [Shield](/packages/shield): CSRF tokens, security headers and CORS when the API serves other origins.
- [Test your app](/guides/testing): the test database these tests run against.
