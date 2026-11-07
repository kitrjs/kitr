import { useEffect, useRef } from 'react'
import type { Page } from '#app/lib/content'
import { Command } from './command'
import { Icon, icons } from './icons'

/** Rendered markdown: HTML blocks from the build, with live package-manager pickers in between. */
export function DocBody({ page }: { page: Page }) {
  const ref = useRef<HTMLDivElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the page changes
  useEffect(() => {
    // Copy buttons on code blocks.
    for (const pre of ref.current?.querySelectorAll<HTMLPreElement>('pre.shiki') ?? []) {
      if (pre.parentElement?.classList.contains('code')) continue
      const wrap = document.createElement('div')
      wrap.className = 'code'
      pre.replaceWith(wrap)
      wrap.append(pre)
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
  }, [page])
  return (
    <div className="prose" ref={ref}>
      {page.blocks.map((block, i) =>
        block.type === 'cmd' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks are static per page
          <Command key={i} cmd={block.cmd} />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks are static per page
          // biome-ignore lint/security/noDangerouslySetInnerHtml: built from the repo's own markdown
          <div key={i} dangerouslySetInnerHTML={{ __html: block.html }} />
        ),
      )}
    </div>
  )
}

export function Toc({ page }: { page: Page }) {
  if (!page.toc.length) return null
  return (
    <nav className="toc" aria-label="On this page">
      <span className="label">On this page</span>
      <ul>
        {page.toc.map((t) => (
          <li key={t.id} data-depth={t.depth}>
            <a href={`#${t.id}`}>{t.text}</a>
          </li>
        ))}
      </ul>
      <a className="toc-edit" href={page.editUrl} target="_blank" rel="noreferrer">
        <Icon icon={icons.edit} size={14} /> Edit this page
      </a>
      <a className="toc-edit" href={`${page.url}.md`}>
        View as markdown
      </a>
    </nav>
  )
}
