import { HeadContent, Outlet, Scripts } from '@kitr/router'
import { ThemeScript } from '@kitr/theme'
import css from '#app/styles/app.css?url'
import contentCss from '@kitr/content/styles.css?url'
import { Link } from '@kitr/router'
import { seo } from '@kitr/seo'
import { loadSearch } from '#kitr/content'
import { SearchDialog } from '#components/ui/search-dialog'
import { ThemeToggle } from '#components/ui/theme-toggle'

/** Head tags for every page. Pages add their own with `head` on their route in app/routes.ts. */
export function head(ctx: object) {
  return {
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ...seo({ title: 'Docs', description: 'Documentation built with kitr.' }, ctx).meta,
    ],
    links: [
      { rel: 'stylesheet', href: css },
      // The look of rendered markdown, over the theme tokens. Drop it to style .prose yourself.
      { rel: 'stylesheet', href: contentCss },
    ],
  }
}

/** The HTML shell. Start streams it on the server and hydrates it on the client. */
export function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SiteHeader />
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link to="/" className="font-semibold">
          Docs
        </Link>
        <Link to="/docs" className="text-sm text-muted-foreground hover:text-foreground">
          Docs
        </Link>
        <div className="flex-1" />
        <SearchDialog load={loadSearch} />
        <ThemeToggle />
      </div>
    </header>
  )
}
