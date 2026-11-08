import {
  type AddContext,
  definePackage,
  displayName,
  removeFiles as remove,
  startDocument,
  writeTemplate as write,
} from '@kitr/core/package'

const routeTable = (routes: Array<[name: string, method: string, path: string]>) =>
  `// Route table for the typed client. Regenerate with \`kitr api:sync\`.\nexport const routeTable = ${JSON.stringify(
    routes.map(([name, method, path]) => ({ name, method, path })),
    null,
    2,
  )} as const\n`

const apiClient = `import { createApiClient, registerRoutes } from 'kitr/api/client'
import type { ServerRoutes } from '#server/routes'
import { routeTable } from './routes.gen'

/** Typed, no codegen: route names, params, bodies and outputs come from the server table. */
export const api = createApiClient<ServerRoutes>({
  baseUrl: typeof window === 'undefined' ? 'http://localhost:' + (process.env.PORT ?? 3000) : '',
})
registerRoutes(api, [...routeTable])
`

const files = (ctx: AddContext, name: string) => {
  const brand = displayName(name)
  remove(ctx, 'app/pages/home.tsx', 'app/pages/about.tsx')
  ctx.scripts.add('api:sync', 'kitr api:sync')

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

  // The server renders <html lang> in the visitor's language; follow a switch made in the browser.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

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
    `import { defineRoutes } from 'kitr/app'
import api from 'kitr/api/routes'
import HealthController from '#server/controllers/health_controller'
import NewsletterController from '#server/controllers/newsletter_controller'

/** Endpoints of this app, served by \`createServer({ routes })\` in server/main.ts. */
export const routes = defineRoutes([api], (root) =>
  root.group('/api', (r) =>
    r
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .post('/newsletter', [NewsletterController, 'subscribe'], { name: 'newsletter.subscribe' }),
  ),
)

/** Pass to createApiClient<ServerRoutes>() on the client. */
export type ServerRoutes = typeof routes.$types
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
    'app/document.tsx',
    startDocument({
      imports: `import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { useTranslation } from 'kitr/i18n'
import { getRouteApi, Link } from 'kitr/router'
import { seo } from 'kitr/seo'
import { LocaleSwitch } from '#app/components/locale-switch'
import { LocaleProvider } from '#app/locale'
import { localeCookie } from '#app/storage'
import { ThemeToggle } from '#components/ui/theme-toggle'

/** Runs on the server only: the visitor's language, straight from the request cookie. The root route's loader (app/routes.ts). */
export const readLocale = createServerFn({ method: 'GET' }).handler(() =>
  localeCookie.get(getRequest().headers),
)

const rootRoute = getRouteApi('__root__')
`,
      prelude: `  const locale = rootRoute.useLoaderData()
`,
      wrap: ['      <LocaleProvider initial={locale}>', '      </LocaleProvider>'],
      headParams: 'ctx: object',
      head: `    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ...seo({ title: '${brand}', description: 'A marketing site built with kitr.' }, ctx).meta,
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
    }).replace('<html lang="en"', '<html lang={locale}'),
  )

  write(
    ctx,
    'app/routes.ts',
    `import { defineRoutes } from 'kitr/app'
import { notFound } from 'kitr/router'
import router from 'kitr/router/routes'
import { seo } from 'kitr/seo'
import { getPost } from '#app/content/posts'
import { head, readLocale, RootDocument } from './document'

/**
 * Every page of the site. Heads and loaders live here; the components live in app/pages and load
 * on first visit. \`kitr make:page <path>\` appends to the chain.
 */
export const routes = defineRoutes([router], (r) =>
  r
    .root({ head, loader: () => readLocale(), component: RootDocument })
    .page('/', { lazy: () => import('./pages/home') })
    .page('/pricing', {
      head: (ctx) =>
        seo({ title: 'Pricing', description: 'Simple plans for every team size.' }, ctx),
      lazy: () => import('./pages/pricing'),
    })
    .group('/blog', (blog) =>
      blog
        .page('/', {
          head: (ctx) => seo({ title: 'Blog', description: 'Notes on building with kitr.' }, ctx),
          lazy: () => import('./pages/blog/index'),
        })
        .page('/$slug', {
          loader: ({ params }) => {
            const post = getPost(params.slug)
            if (!post) throw notFound()
            return post
          },
          head: (ctx) =>
            seo(
              { title: ctx.loaderData?.title, description: ctx.loaderData?.excerpt, type: 'article' },
              ctx,
            ),
          lazy: () => import('./pages/blog/post'),
        }),
    ),
)

export type AppRoutes = typeof routes.$types
`,
  )

  write(
    ctx,
    'app/pages/home.tsx',
    `import { useSchemaForm } from 'kitr/forms'
import { useTranslation } from 'kitr/i18n'
import { useMutation } from 'kitr/query'
import { mutationFrom } from 'kitr/query'
import { Link } from 'kitr/router'
import { useState } from 'react'
import { api } from '#app/api/client'
import { subscribeSchema } from '#app/features/newsletter/schema'
import { buttonVariants } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { FieldInput, Form, FormField, FormMessage, SubmitButton } from '#components/ui/form'

const subscribe = mutationFrom(api.newsletter.subscribe.mutation())

export default function HomePage() {
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
  const mutation = useMutation(subscribe)
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
    'app/pages/pricing.tsx',
    `import { Button } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { PageHeader } from '#components/ui/page-header'

const tiers = [
  { name: 'Hobby', price: 'Free', features: ['1 project', 'Community support'] },
  { name: 'Team', price: '$29', features: ['Unlimited projects', 'Email support', 'SSO'] },
  { name: 'Enterprise', price: 'Talk to us', features: ['Dedicated support', 'Custom contracts'] },
]

export default function PricingPage() {
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
    'app/pages/blog/index.tsx',
    `import { Link } from 'kitr/router'
import { posts } from '#app/content/posts'
import { PageHeader } from '#components/ui/page-header'

export default function BlogIndexPage() {
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
    'app/pages/blog/post.tsx',
    `import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { definePage, getRouteApi, Link } from 'kitr/router'
import { Icon } from '#components/ui/icon'

const route = getRouteApi('/blog/$slug')

/** The page and what renders when the loader in app/routes.ts throws notFound(). */
export default definePage({
  component: PostPage,
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">No such post</h1>
      <Link to="/blog" className="mt-4 inline-block underline">
        Back to the blog
      </Link>
    </main>
  ),
})

function PostPage() {
  const post = route.useLoaderData()
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

/**
 * `kitr new --kit site`: A marketing site: server-rendered with prerendering, SEO heads, i18n (en/de), a blog and a newsletter form on a controller.
 */
export default definePackage({
  name: 'site',
  kind: 'kit',
  kit: {
    description:
      'A marketing site: server-rendered with prerendering, SEO heads, i18n (en/de), a blog and a newsletter form on a controller.',
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
      'query',
      'forms',
      'tailwind',
      'theme',
      'i18n',
      'storage',
      'analytics',
      'testing',
      'seo',
      'api',
    ],
    components: ['icon', 'button', 'input', 'label', 'card', 'form', 'page-header', 'theme-toggle'],
    files,
  },
})
