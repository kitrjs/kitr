import { defineRoutes } from '@kitr/kitr/app'
import { notFound } from '@kitr/router'
import router from '@kitr/router/routes'
import { seo } from '@kitr/seo'
import { loadPage } from '#kitr/content'
import { head, RootDocument } from './document'

/**
 * Every page of the site. The docs pages are the markdown in content/docs, rendered by
 * `kitr generate`; the loader reads one and `seo()` takes its title and description.
 */
export const routes = defineRoutes([router], (r) =>
  r
    .root({ head, component: RootDocument })
    .page('/', { lazy: () => import('./pages/docs') })
    .page('/docs', {
      head: (ctx) => seo({ title: 'Docs' }, ctx),
      lazy: () => import('./pages/docs'),
    })
    .page('/docs/$slug', {
      loader: async ({ params }) => {
        const page = await loadPage('docs', params.slug)
        if (!page) throw notFound()
        return page
      },
      head: (ctx) => seo({ type: 'article' }, ctx),
      lazy: () => import('./pages/docs/slug'),
    }),
)

export type AppRoutes = typeof routes.$types
