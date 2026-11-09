import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Menu01Icon,
  PencilEdit02Icon,
} from '@hugeicons/core-free-icons'
import type { NavGroup, Page } from '@kitr/content'
import { DocBody, useActiveHeading } from '@kitr/content/react'
import { Link } from '@kitr/router'
import { cn } from '@kitr/tailwind'
import { type ReactNode, useEffect, useState } from 'react'
import { Command } from '#components/ui/command'
import { Icon } from '#components/ui/icon'

export interface DocLayoutProps {
  /** The page from `loadPage(collection, slug)`. */
  page: Page
  /** The collection's groups: `nav.docs` from `#kitr/content`. */
  nav: NavGroup[]
  /** The collection's URL prefix, such as `/docs`. */
  base: string
  /** The current page's slug. */
  slug: string
  /** Render a `kitr ...` command block. Default: the package-manager picker. */
  renderCommand?: (cmd: string) => ReactNode
  className?: string
}

/**
 * A docs page: the sidebar (every group, the current page's sections with the one being read
 * marked), the page itself, an edit link and the previous and next pages. On small screens the
 * sidebar folds behind a Menu button.
 */
export function DocLayout({
  page,
  nav,
  base,
  slug,
  renderCommand = (cmd) => <Command cmd={cmd} />,
  className,
}: DocLayoutProps) {
  const [open, setOpen] = useState(false)
  const active = useActiveHeading(page.toc)
  const flat = nav.flatMap((g) => g.items)
  const index = flat.findIndex((i) => i.slug === slug)
  const prev = index > 0 ? flat[index - 1] : undefined
  const next = index >= 0 ? flat[index + 1] : undefined
  const href = (s: string) => `${base.replace(/\/+$/, '')}/${s}`

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the menu whenever the page changes
  useEffect(() => setOpen(false), [slug])

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 lg:flex-row lg:gap-10',
        className,
      )}
    >
      <button
        type="button"
        className="mt-4 inline-flex items-center gap-2 self-start rounded-md border border-border px-3 py-1.5 text-sm lg:hidden"
        aria-expanded={open}
        aria-controls="doc-sidebar"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon icon={Menu01Icon} size={16} />
        Menu
      </button>
      <aside
        id="doc-sidebar"
        className={cn(
          'shrink-0 lg:sticky lg:top-14 lg:block lg:h-[calc(100vh-3.5rem)] lg:w-60 lg:overflow-y-auto lg:py-8',
          open ? 'block' : 'hidden',
        )}
      >
        <nav aria-label="Docs" className="flex flex-col gap-6 text-sm">
          {nav.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const current = item.slug === slug
                  return (
                    <li key={item.slug}>
                      <Link
                        to={href(item.slug)}
                        aria-current={current ? 'page' : undefined}
                        className={cn(
                          'block rounded-md px-2 py-1.5 hover:bg-muted',
                          current && 'bg-muted font-medium text-foreground',
                        )}
                      >
                        {item.title}
                      </Link>
                      {current && page.toc.length > 0 && (
                        <ul className="my-1 ml-3 border-l border-border">
                          {page.toc.map((t) => (
                            <li key={t.id}>
                              <a
                                href={`#${t.id}`}
                                aria-current={t.id === active ? 'location' : undefined}
                                className={cn(
                                  '-ml-px block border-l border-transparent py-1 text-muted-foreground hover:text-foreground aria-[current=location]:border-primary aria-[current=location]:text-foreground',
                                  t.depth === 3 ? 'pl-6' : 'pl-3',
                                )}
                              >
                                {t.text}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 max-w-3xl flex-1 pb-16 lg:py-8">
        <p className="text-sm font-medium text-primary">{page.section}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{page.title}</h1>
        {page.description && (
          <p className="mt-3 text-lg text-muted-foreground">{page.description}</p>
        )}
        <DocBody page={page} renderCommand={renderCommand} className="mt-8" />
        {page.editUrl && (
          <a
            href={page.editUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Icon icon={PencilEdit02Icon} size={14} />
            Edit this page
          </a>
        )}
        <nav
          aria-label="Previous and next"
          className="mt-8 grid gap-3 border-t border-border pt-6 sm:grid-cols-2"
        >
          {prev ? (
            <Link
              to={href(prev.slug)}
              className="flex flex-col rounded-lg border border-border p-4 hover:border-primary"
            >
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Icon icon={ArrowLeft01Icon} size={12} />
                Previous
              </span>
              <span className="font-medium">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              to={href(next.slug)}
              className="flex flex-col items-end rounded-lg border border-border p-4 text-right hover:border-primary"
            >
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                Next
                <Icon icon={ArrowRight01Icon} size={12} />
              </span>
              <span className="font-medium">{next.title}</span>
            </Link>
          )}
        </nav>
      </main>
    </div>
  )
}
