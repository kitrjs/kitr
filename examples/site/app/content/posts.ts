/** Content lives in code for the demo; swap for a CMS or MDX loader and keep the routes. */
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
      'config/ssr.ts lists the routes to prerender and crawls links from them at build time, so this post is a plain HTML file on the CDN.',
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
