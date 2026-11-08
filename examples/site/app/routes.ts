import { defineRoutes } from 'kitr/app'
import { notFound } from 'kitr/router'
import router from 'kitr/router/routes'
import { seo } from 'kitr/seo'
import { getPost } from '#app/content/posts'
import { head, readLocale, RootDocument } from './document'

/**
 * Every page of the site. Heads and loaders live here; the components live in app/pages and load
 * on first visit. `kitr make:page <path>` appends to the chain.
 */
export const routes = defineRoutes([router], (r) =>
  r
    .root({ head, loader: () => readLocale(), component: RootDocument })
    .page('/', { lazy: () => import('./pages/home') })
    .page('/pricing', {
      head: () => seo({ title: 'Pricing', description: 'Simple plans for every team size.' }),
      lazy: () => import('./pages/pricing'),
    })
    .group('/blog', (blog) =>
      blog
        .page('/', {
          head: () => seo({ title: 'Blog', description: 'Notes on building with kitr.' }),
          lazy: () => import('./pages/blog/index'),
        })
        .page('/$slug', {
          loader: ({ params }) => {
            const post = getPost(params.slug)
            if (!post) throw notFound()
            return post
          },
          head: ({ loaderData }) =>
            seo({ title: loaderData?.title, description: loaderData?.excerpt, type: 'article' }),
          lazy: () => import('./pages/blog/post'),
        }),
    ),
)

export type AppRoutes = typeof routes.$types
