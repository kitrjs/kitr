import { useRouter } from '@kitr/router'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { Page, TocEntry } from './model'

/** Props of `<DocBody>`. */
export interface DocBodyProps {
  /** The page from `loadPage(collection, slug)`. Only `blocks` and `steps` are read. */
  page: Pick<Page, 'blocks' | 'steps'>
  /**
   * Render a `kitr ...` command block, such as a package-manager picker:
   * `renderCommand={(cmd) => <Command cmd={cmd} />}`. Default: a plain code block.
   */
  renderCommand?: (cmd: string) => ReactNode
  /** Classes added after `prose`. */
  className?: string
}

const defaultCommand = (cmd: string) => (
  <div className="code">
    <pre className="cmd">
      <code>{cmd}</code>
    </pre>
  </div>
)

/**
 * Add a Copy button to each code block that has none: a `pre` in `div.code` (as the pipeline
 * writes them), or a bare `pre` in the HTML. A command rendered by `renderCommand` brings its own.
 */
function addCopyButtons(root: HTMLElement) {
  for (const pre of root.querySelectorAll<HTMLPreElement>('pre')) {
    let wrap = pre.parentElement
    const wrapped = wrap?.classList.contains('code')
    if (!wrapped && pre.closest('.cmd-block')) continue
    if (!wrapped || !wrap) {
      wrap = document.createElement('div')
      wrap.className = 'code'
      pre.replaceWith(wrap)
      wrap.append(pre)
    }
    if (wrap.querySelector(':scope > .code-copy')) continue
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'code-copy'
    button.setAttribute('aria-label', 'Copy code')
    button.textContent = 'Copy'
    button.onclick = async () => {
      try {
        await navigator.clipboard.writeText(pre.textContent ?? '')
        button.textContent = 'Copied'
        setTimeout(() => {
          button.textContent = 'Copy'
        }, 1500)
      } catch {}
    }
    wrap.append(button)
  }
}

/**
 * A page's rendered markdown: the HTML blocks from `kitr generate` with each `kitr` command
 * rendered by `renderCommand` between them. It adds a Copy button to every code block and keeps
 * clicks on internal links (`/docs/cli`) in the app's router instead of reloading the page.
 */
export function DocBody({ page, renderCommand = defaultCommand, className }: DocBodyProps) {
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter({ warn: false }) as ReturnType<typeof useRouter> | undefined
  useEffect(() => {
    if (ref.current && page.blocks) addCopyButtons(ref.current)
  }, [page.blocks])
  const classes = ['prose', page.steps ? 'steps' : '', className ?? ''].filter(Boolean).join(' ')
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: delegates clicks on real links, which handle the keyboard themselves
    // biome-ignore lint/a11y/noStaticElementInteractions: see above
    <div
      className={classes}
      ref={ref}
      onClick={(e) => {
        if (!router || e.defaultPrevented || e.button !== 0) return
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        const link = (e.target as HTMLElement).closest?.('a')
        const href = link?.getAttribute('href')
        if (!link || !href?.startsWith('/') || href.startsWith('//')) return
        if (link.target || link.hasAttribute('download') || /\.(md|txt)(#|$)/.test(href)) return
        e.preventDefault()
        void router.navigate({ href })
      }}
    >
      {page.blocks.map((block, i) =>
        block.type === 'cmd' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: a page's blocks never reorder
          <div key={i} className="cmd-block">
            {renderCommand(block.cmd)}
          </div>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: a page's blocks never reorder
          // biome-ignore lint/security/noDangerouslySetInnerHtml: rendered at build time from the project's own markdown
          <div key={i} dangerouslySetInnerHTML={{ __html: block.html }} />
        ),
      )}
    </div>
  )
}

/**
 * The id of the heading being read: the last one whose top has scrolled above `offset` pixels
 * (the height of a sticky header, plus some), or the last heading once the page is at its end.
 */
export function useActiveHeading(toc: TocEntry[], offset = 120): string | undefined {
  const [active, setActive] = useState<string | undefined>()
  useEffect(() => {
    if (!toc.length) {
      setActive(undefined)
      return
    }
    let frame = 0
    const update = () => {
      frame = 0
      let current: string | undefined
      for (const t of toc) {
        const el = document.getElementById(t.id)
        if (el && el.getBoundingClientRect().top < offset) current = t.id
        else if (el) break
      }
      // At the very bottom the last short sections never reach the top; mark the last one.
      if (
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      )
        current = toc.at(-1)?.id
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('hashchange', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('hashchange', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [toc, offset])
  return active
}

/** Props of `<Toc>`. */
export interface TocProps {
  /** The page from `loadPage(collection, slug)`. `toc` and `editUrl` are read. */
  page: Pick<Page, 'toc' | 'editUrl'>
  /** The label above the list and the navigation's name. Default `On this page`. */
  title?: string
  /** The heading to mark as current. Default: `useActiveHeading(page.toc)`. */
  active?: string
  className?: string
}

/** "On this page": the page's h2 and h3 as links, the one being read marked, and an edit link when the page has one. */
export function Toc({ page, title = 'On this page', active, className }: TocProps) {
  const reading = useActiveHeading(page.toc)
  const current = active ?? reading
  if (!page.toc.length && !page.editUrl) return null
  return (
    <nav className={['toc', className ?? ''].filter(Boolean).join(' ')} aria-label={title}>
      {page.toc.length > 0 && (
        <>
          <p className="toc-title">{title}</p>
          <ul>
            {page.toc.map((t) => (
              <li key={t.id} data-depth={t.depth}>
                <a href={`#${t.id}`} aria-current={t.id === current ? 'location' : undefined}>
                  {t.text}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {page.editUrl && (
        <a className="toc-edit" href={page.editUrl} target="_blank" rel="noreferrer">
          Edit this page
        </a>
      )}
    </nav>
  )
}
