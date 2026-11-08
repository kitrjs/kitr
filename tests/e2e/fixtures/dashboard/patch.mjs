import { join } from 'node:path'
import { aboutPage, replaceIn } from '../../patch-utils.mjs'

/** Links the notes page into the route table, the way `kitr make:page` would append it. */
export default function patch({ target }) {
  replaceIn(
    join(target, 'app/routes.ts'),
    aboutPage,
    `${aboutPage}\n    .page('/e2e/notes', { lazy: () => import('./pages/e2e/notes') })`,
  )
}
