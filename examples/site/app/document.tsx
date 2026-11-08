import { HeadContent, Outlet, Scripts } from 'kitr/router'
import { ThemeScript } from 'kitr/theme'
import css from '#app/styles/app.css?url'
import { createServerFn } from '@tanstack/react-start'
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

/** Head tags for every page. Pages add their own with `head` on their route in app/routes.ts. */
export function head(ctx: object) {
  return {
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ...seo({ title: 'Site', description: 'A marketing site built with kitr.' }, ctx).meta,
    ],
    links: [{ rel: 'stylesheet', href: css }],
  }
}

/** The HTML shell. Start streams it on the server and hydrates it on the client. */
export function RootDocument() {
  const locale = rootRoute.useLoaderData()
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <LocaleProvider initial={locale}>
        <SiteHeader />
        <Outlet />
        <SiteFooter />
        </LocaleProvider>
        <Scripts />
      </body>
    </html>
  )
}

function SiteHeader() {
  const { t } = useTranslation()
  const link = 'rounded-md px-3 py-1.5 text-sm hover:bg-muted [&.active]:bg-muted [&.active]:font-medium'
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-4">
        <Link to="/" className="mr-4 font-semibold">
          Site
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
