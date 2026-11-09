import { describe, expect, it } from 'vitest'
import { parseFrontmatter, renderMarkdown } from '../src/markdown'

const html = (r: Awaited<ReturnType<typeof renderMarkdown>>) =>
  r.blocks.map((b) => (b.type === 'html' ? b.html : `[cmd ${b.cmd}]`)).join('')

describe('parseFrontmatter', () => {
  it('reads key: value lines, unquotes and turns order into a number', () => {
    const { data, body } = parseFrontmatter(
      '---\ntitle: \'Getting started\'\ndescription: "From zero to a page"\norder: 2\n---\n\n# Hi\n',
    )
    expect(data).toEqual({
      title: 'Getting started',
      description: 'From zero to a page',
      order: 2,
    })
    expect(body).toBe('\n# Hi\n')
  })

  it('returns the source unchanged without frontmatter', () => {
    expect(parseFrontmatter('# Hi\n')).toEqual({ data: {}, body: '# Hi\n' })
  })
})

describe('renderMarkdown', () => {
  it('drops the leading h1 and returns it as the heading', async () => {
    const r = await renderMarkdown('# Install\n\nSome text.\n')
    expect(r.heading).toBe('Install')
    expect(html(r)).not.toContain('<h1')
    expect(r.intro).toBe('Some text.')
  })

  it('turns GitHub alerts into callouts with titles', async () => {
    const r = await renderMarkdown(
      '> [!NOTE]\n> Plain note.\n\n> [!WARNING] Production refuses to boot\n> Set a secret.\n\n> [!TIP]\n> A **bold** tip.\n\n> [!SUMMARY]\n> The gist.\n',
    )
    const out = html(r)
    expect(out).toContain('<aside class="callout callout-note" role="note">')
    expect(out).toContain('<p class="callout-title">Note</p>')
    expect(out).toContain('<p class="callout-title">Production refuses to boot</p>')
    expect(out).toContain('<p>Set a secret.</p>')
    expect(out).toContain('class="callout callout-tip"')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).toContain('<p class="callout-title">The short version</p>')
  })

  it('reads the legacy > **Warning** form as a warning callout', async () => {
    const out = html(await renderMarkdown('> **Warning**\n> Data is deleted.\n'))
    expect(out).toContain('class="callout callout-warning"')
    expect(out).toContain('<p class="callout-title">Warning</p>')
    expect(out).toContain('Data is deleted.')
  })

  it('keeps a plain blockquote a blockquote', async () => {
    expect(html(await renderMarkdown('> Just a quote.\n'))).toContain('<blockquote>')
  })

  it('makes a shell block of kitr commands a cmd block between html blocks', async () => {
    const r = await renderMarkdown(
      'Before.\n\n```sh\nkitr add content\nkitr generate\n```\n\nAfter.\n\n```sh\nnpm install\n```\n',
    )
    expect(r.blocks.map((b) => b.type)).toEqual(['html', 'cmd', 'html'])
    expect(r.blocks[1]).toEqual({ type: 'cmd', cmd: 'kitr add content\nkitr generate' })
    expect(html(r)).toContain('data-lang="sh"')
  })

  it('highlights code with both themes and a data-lang, unknown languages as text', async () => {
    const out = html(await renderMarkdown('```ts\nconst a = 1\n```\n\n```nope\nhello\n```\n'))
    expect(out).toContain('<div class="code"><pre data-lang="ts" class="shiki')
    expect(out).toContain('--shiki-light:')
    expect(out).toContain('--shiki-dark:')
    expect(out).toContain('data-lang="text"')
  })

  it('turns a first line naming a file into a caption', async () => {
    const out = html(
      await renderMarkdown(
        "```ts\n// app/routes.ts\nexport const routes = 1\n```\n\n```ts\n// => { id: 'msg_1' }\n```\n",
      ),
    )
    expect(out).toContain('<div class="code-file">app/routes.ts</div>')
    expect(out).toContain('data-file="app/routes.ts"')
    expect(out).not.toMatch(/<span[^>]*>\/\/ app\/routes\.ts/)
    // A comment that is not a path stays code.
    expect(out.match(/code-file/g)).toHaveLength(1)
  })

  it('collects h2/h3 into the toc and the text of each section for search', async () => {
    const r = await renderMarkdown(
      'Intro text.\n\n## Install it\n\nRun the command.\n\n### With pnpm\n\n- one\n- two\n\n## Configure\n\n| Option | Default |\n| --- | --- |\n| `llms` | `false` |\n',
    )
    expect(r.toc).toEqual([
      { depth: 2, id: 'install-it', text: 'Install it' },
      { depth: 3, id: 'with-pnpm', text: 'With pnpm' },
      { depth: 2, id: 'configure', text: 'Configure' },
    ])
    expect(r.intro).toBe('Intro text.')
    expect(r.sections.map((s) => [s.heading, s.text])).toEqual([
      ['Install it', 'Run the command.'],
      ['With pnpm', 'one two'],
      ['Configure', 'llms false'],
    ])
    expect(html(r)).toContain('<div class="table-wrap" tabindex="0"><table>')
  })

  it('numbers step headings and flags the page', async () => {
    const r = await renderMarkdown('## 1. Install the CLI\n\nText.\n\n## 2. Create a page\n')
    expect(r.steps).toBe(true)
    expect(r.toc[0]).toEqual({ depth: 2, id: '1-install-the-cli', text: 'Install the CLI' })
    expect(html(r)).toContain(
      '<h2 id="1-install-the-cli" class="step-heading"><span class="step-marker" aria-hidden="true">1</span>Install the CLI</h2>',
    )
    expect((await renderMarkdown('## Install\n')).steps).toBe(false)
  })

  it('turns a final Next steps list of links into cards', async () => {
    const out = html(
      await renderMarkdown(
        '## Next steps\n\n- [Writing pages](/docs/writing): frontmatter and callouts.\n- [Deploy](https://acme.com/deploy)\n',
      ),
    )
    expect(out).toContain('<nav class="next-cards" aria-label="Next steps">')
    expect(out).toContain(
      '<a href="/docs/writing" class="next-card"><strong class="next-card-title">Writing pages</strong><span>frontmatter and callouts.</span></a>',
    )
    expect(out).toContain('target="_blank"')
    expect(out).not.toContain('<ul>')
  })

  it('leaves a Next steps section that is not only links alone', async () => {
    const out = html(await renderMarkdown('## Next steps\n\n- Read the [guide](/docs/guide)\n'))
    expect(out).not.toContain('next-cards')
  })

  it('opens external links in a new tab and keeps internal ones', async () => {
    const out = html(await renderMarkdown('[Acme](https://acme.com) and [CLI](/docs/cli).\n'))
    expect(out).toContain('<a href="https://acme.com" target="_blank" rel="noreferrer">Acme</a>')
    expect(out).toContain('<a href="/docs/cli">CLI</a>')
  })

  it('rewrites relative .md links through resolveLink', async () => {
    const seen: string[] = []
    const out = html(
      await renderMarkdown('[CLI](./cli.md#flags), [Kits](kits.md), [x](https://a.com/b.md)\n', {
        resolveLink: (href) => {
          seen.push(href)
          return href.startsWith('./cli.md') ? '/docs/cli#flags' : undefined
        },
      }),
    )
    expect(seen).toEqual(['./cli.md#flags', 'kits.md'])
    expect(out).toContain('<a href="/docs/cli#flags">CLI</a>')
    expect(out).toContain('<a href="kits.md">Kits</a>')
  })
})
