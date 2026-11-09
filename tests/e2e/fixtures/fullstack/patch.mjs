import { join } from 'node:path'
import { aboutPage, prependTo, replaceIn } from '../../patch-utils.mjs'

/** Links the fixture pages into the route table and the fixture endpoints into the server routes. */
export default function patch({ target }) {
  // Pages, the way `kitr make:page` would append them after the kit's own.
  const pages = join(target, 'app/routes.ts')
  replaceIn(
    pages,
    aboutPage,
    `${aboutPage}
    .page('/e2e/counter', { lazy: () => import('./pages/e2e/counter') })
    .page('/e2e/me', {
      loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
      lazy: () => import('./pages/e2e/me'),
    })
    .page('/e2e/notes', {
      loader: ({ context }) => context.queryClient.fetchQuery(notesQuery),
      lazy: () => import('./pages/e2e/notes'),
    })
    .page('/e2e/tasks', {
      loader: ({ context }) =>
        context.queryClient.ensureQueryData(queryOptions(context.app, 'e2e.tasks.list')),
      lazy: () => import('./pages/e2e/tasks'),
    })
    .page('/e2e/socket', { lazy: () => import('./pages/e2e/socket') })`,
  )
  prependTo(
    pages,
    "import { queryOptions } from '@kitr/query'\nimport { meQuery } from '#app/e2e/me-query'\nimport { notesQuery } from '#app/e2e/notes-query'\n",
  )

  // Endpoints. `/e2e/emit` pushes an event down a socket channel through the realtime server the
  // table's `.ws` link binds in the container; `/e2e/notes` is a record a test creates and reads back.
  const server = join(target, 'server/routes.ts')
  replaceIn(
    server,
    "r.get('/health'",
    `r.post('/e2e/emit', async (ctx) => { const body = ctx.body as { room: string; text: string }; ctx.app.container.use('realtime').use(exampleChannel, { room: body.room }).emit('message', body.text); return { sent: true } }, { name: 'e2e.emit' })
      .get('/e2e/notes', () => ({ notes: listNotes() }), { name: 'e2e.notes.index' })
      .post('/e2e/notes', async (ctx) => {
        const body = ctx.body as { text?: string }
        if (typeof body?.text !== 'string' || !body.text.trim()) { ctx.response.status(422); return { code: 'INVALID', message: 'text is required' } }
        ctx.response.status(201)
        return addNote(body.text.trim())
      }, { name: 'e2e.notes.store' })
      .get('/health'`,
  )
  prependTo(server, "import { addNote, listNotes } from '#app/e2e/notes-store'\n")
}
