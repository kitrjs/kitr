// Builds kitr.dev's content from the monorepo:
// - every package.json "kitr" block becomes a package card,
// - every packages/*/docs/*.md becomes a package page,
// - site/content/docs (plus the files nav.json points at) becomes /docs,
// - packages/*/examples/*.tsx become live examples at /play/<pkg>/<example>.
// Output goes to app/generated (gitignored) and public/llms*.txt.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { createHighlighter } from 'shiki'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { ogImage, readCatalog, touchIcon } from './og.mjs'
import { buildPlatforms } from './platforms.mjs'

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repo = resolve(site, '..')
const out = join(site, 'app/generated')
const repoUrl = 'https://github.com/kitrjs/kitr'

const highlighter = await createHighlighter({
  themes: ['github-light-high-contrast', 'github-dark'],
  langs: ['ts', 'tsx', 'js', 'json', 'sh', 'css', 'html', 'md'],
})
const langs = new Set(highlighter.getLoadedLanguages())

// ---------------------------------------------------------------- markdown

export function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) return { data: {}, body: source }
  const data = {}
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/)
    if (m) data[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  if (data.order) data.order = Number(data.order)
  return { data, body: source.slice(match[0].length) }
}

const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** Code blocks: shiki with both themes; `kitr ...` shell blocks become package-manager pickers. */
function remarkCode() {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      const lines = node.value.split('\n').filter((l) => l.trim())
      const isShell = ['sh', 'bash', 'shell'].includes(node.lang ?? '')
      if (isShell && lines.length && lines.every((l) => /^kitr\s/.test(l.trim()))) {
        parent.children[index] = {
          type: 'html',
          value: `<kitr-cmd data-cmd="${escapeAttr(lines.join('\n'))}"></kitr-cmd>`,
        }
        return
      }
      const lang = langs.has(node.lang) ? node.lang : 'text'
      const html = highlighter.codeToHtml(node.value, {
        lang,
        themes: { light: 'github-light-high-contrast', dark: 'github-dark' },
        defaultColor: false,
      })
      parent.children[index] = {
        type: 'html',
        value: html.replace('<pre ', `<pre data-lang="${lang}" `),
      }
    })
  }
}

/** Collect h2/h3 for the table of contents, and the plain text for search. */
function rehypeCollect(state) {
  return () => (tree) => {
    const text = (node) =>
      node.type === 'text' ? node.value : (node.children ?? []).map(text).join('')
    visit(tree, 'element', (node) => {
      if ((node.tagName === 'h2' || node.tagName === 'h3') && node.properties?.id) {
        state.toc.push({ depth: Number(node.tagName[1]), id: node.properties.id, text: text(node) })
        state.sections.push({ id: node.properties.id, heading: text(node), text: '' })
      } else if (node.tagName === 'p' || node.tagName === 'li' || node.tagName === 'td') {
        const current = state.sections.at(-1) ?? state.intro
        current.text += ` ${text(node)}`
      }
    })
    // Wide tables scroll inside a focusable region so keyboard users can scroll them too.
    visit(tree, 'element', (node, index, parent) => {
      if (
        node.tagName !== 'table' ||
        !parent ||
        parent.properties?.className?.includes('table-wrap')
      )
        return
      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrap'], tabIndex: 0 },
        children: [node],
      }
    })
    // Open external links in a new tab; keep internal ones in the router.
    visit(tree, 'element', (node) => {
      if (node.tagName === 'a' && /^https?:/.test(node.properties?.href ?? '')) {
        node.properties.target = '_blank'
        node.properties.rel = 'noreferrer'
      }
    })
  }
}

async function render(markdown) {
  const state = { toc: [], sections: [], intro: { id: '', heading: '', text: '' } }
  // Drop the leading H1: pages render their title from frontmatter.
  const body = markdown.replace(/^\s*# .*\n/, '')
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkCode)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeCollect(state))
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(body)
  const html = String(file)
  // Split into HTML and command blocks so React can render the picker.
  const blocks = []
  let last = 0
  for (const m of html.matchAll(/<kitr-cmd data-cmd="([^"]*)"><\/kitr-cmd>/g)) {
    if (m.index > last) blocks.push({ type: 'html', html: html.slice(last, m.index) })
    blocks.push({
      type: 'cmd',
      cmd: m[1]
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&'),
    })
    last = m.index + m[0].length
  }
  if (last < html.length) blocks.push({ type: 'html', html: html.slice(last) })
  return { blocks, toc: state.toc, intro: state.intro.text.trim(), sections: state.sections }
}

// ---------------------------------------------------------------- packages

const packages = []
for (const dir of readdirSync(join(repo, 'packages')).sort()) {
  const file = join(repo, 'packages', dir, 'package.json')
  if (!existsSync(file)) continue
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  if (!pkg.kitr) continue
  // Kits are not packages you add; the home page and the CLI docs present them.
  if (pkg.kitr.kind === 'kit') continue
  const docsDir = join(repo, 'packages', dir, pkg.kitr.docs ?? 'docs')
  const examplesDir = join(repo, 'packages', dir, 'examples')
  packages.push({
    dir,
    docsDir,
    entry: {
      ...pkg.kitr,
      package: pkg.name,
      version: pkg.version,
      description: pkg.description,
      repo: `${repoUrl}/tree/main/packages/${dir}`,
      pages: [],
      examples: existsSync(examplesDir)
        ? readdirSync(examplesDir)
            .filter((f) => f.endsWith('.tsx'))
            .map((f) => {
              const src = readFileSync(join(examplesDir, f), 'utf8')
              const meta = src.match(/export const meta = (\{[\s\S]*?\n\})/)
              const data = meta ? Function(`return ${meta[1]}`)() : {}
              return { slug: f.replace(/\.tsx$/, ''), ...data }
            })
        : [],
    },
  })
}

// ---------------------------------------------------------------- kits

// Every kit but blank is a package (`kind: 'kit'`); its built setup module says what it sets up.
// Needs `pnpm build` first, like the examples.
const kitOrder = [
  'app',
  'fullstack',
  'server',
  'saas',
  'site',
  'realtime',
  'desktop',
  'tauri',
  'mobile',
]
const kits = [
  {
    name: 'blank',
    text: 'The wiring files and nothing else: no platform, no React, no server. kitr add brings each.',
    platforms: [],
    packages: [],
    components: 0,
  },
]
for (const name of kitOrder) {
  const dist = join(repo, 'packages', `kit-${name}`, 'dist/kitr.js')
  if (!existsSync(dist)) throw new Error(`${dist} is missing: run pnpm build first`)
  const { default: definition } = await import(pathToFileURL(dist).href)
  const kit = definition.kit
  kits.push({
    name: definition.name,
    text: kit.description,
    platforms: Object.entries(kit.platforms ?? {}).map(([n, p]) => `${n}: ${p.type}`),
    packages: kit.packages.map((p) => (typeof p === 'string' ? p : p.name)),
    components: kit.components?.length ?? 0,
  })
}

rmSync(out, { recursive: true, force: true })
for (const dir of ['docs', 'packages', 'og'])
  rmSync(join(site, 'public', dir), { recursive: true, force: true })
mkdirSync(join(out, 'pages'), { recursive: true })
writeFileSync(join(out, 'kits.json'), JSON.stringify(kits, null, 2))

const search = []
const llms = []
const writePage = (id, page) =>
  writeFileSync(join(out, 'pages', `${id}.json`), JSON.stringify(page))
const addSearch = (url, title, section, rendered, summary) => {
  search.push({
    url,
    title,
    section,
    heading: '',
    text: `${summary ?? ''} ${rendered.intro}`.trim(),
  })
  for (const s of rendered.sections)
    search.push({ url: `${url}#${s.id}`, title, section, heading: s.heading, text: s.text.trim() })
}

for (const { dir, docsDir, entry } of packages) {
  if (!existsSync(docsDir)) continue
  const files = readdirSync(docsDir).filter((f) => f.endsWith('.md'))
  for (const f of files) {
    const source = readFileSync(join(docsDir, f), 'utf8')
    const { data, body } = parseFrontmatter(source)
    const slug = f === 'index.md' ? '' : f.replace(/\.md$/, '')
    const url = slug ? `/packages/${entry.name}/${slug}` : `/packages/${entry.name}`
    const rendered = await render(body)
    entry.pages.push({ slug, title: data.title, order: data.order ?? 99 })
    writePage(`pkg__${entry.name}__${slug || 'index'}`, {
      url,
      title: data.title,
      description: data.description,
      blocks: rendered.blocks,
      toc: rendered.toc,
      editUrl: `${repoUrl}/edit/main/${relative(repo, join(docsDir, f))}`,
    })
    addSearch(
      url,
      slug ? `${entry.title}: ${data.title}` : entry.title,
      'Packages',
      rendered,
      entry.summary,
    )
    llms.push({
      url,
      title: slug ? `${entry.title} ${data.title}` : entry.title,
      description: data.description,
      body,
    })
  }
  entry.pages.sort((a, b) => a.order - b.order)
  if (!files.length)
    search.push({
      url: `/packages/${entry.name}`,
      title: entry.title,
      section: 'Packages',
      heading: '',
      text: entry.summary,
    })
  void dir
}

writeFileSync(
  join(out, 'packages.json'),
  JSON.stringify(
    packages.map((p) => p.entry),
    null,
    2,
  ),
)

// Planned packages from the package map; a built package with the same name wins.
const built = new Set(packages.map((p) => p.entry.name))
const roadmap = JSON.parse(readFileSync(join(site, 'content/roadmap.json'), 'utf8'))
const planned = roadmap.packages.filter((p) => !built.has(p.name))
writeFileSync(join(out, 'planned.json'), JSON.stringify(planned, null, 2))
for (const p of planned)
  search.push({
    url: `/packages#${p.name}`,
    title: p.name,
    section: p.status === 'later' ? 'Roadmap' : 'Coming soon',
    heading: '',
    text: p.summary,
  })

// ---------------------------------------------------------------- docs

const nav = JSON.parse(readFileSync(join(site, 'content/docs/nav.json'), 'utf8'))
const docsNav = []
for (const group of nav) {
  const items = []
  for (const item of group.pages) {
    const path = item.source
      ? join(site, 'content/docs', item.source)
      : join(site, 'content/docs', `${item.slug}.md`)
    const source = readFileSync(path, 'utf8')
    const parsed = parseFrontmatter(source)
    const data = parsed.data
    // Repo docs link to each other as `cli.md`; on the site they live at /docs/cli.
    const body = item.source
      ? parsed.body.replace(/\]\(([\w-]+)\.md(#[\w-]+)?\)/g, '](/docs/$1$2)')
      : parsed.body
    const title = item.title ?? data.title
    const description = item.description ?? data.description
    const url = `/docs/${item.slug}`
    const rendered = await render(body)
    writePage(`docs__${item.slug}`, {
      url,
      title,
      description,
      section: group.title,
      blocks: rendered.blocks,
      toc: rendered.toc,
      editUrl: `${repoUrl}/edit/main/${relative(repo, path)}`,
    })
    items.push({ slug: item.slug, title })
    addSearch(url, title, group.title, rendered, description)
    llms.push({ url, title, description, body })
  }
  docsNav.push({ title: group.title, items })
}
writeFileSync(join(out, 'docs-nav.json'), JSON.stringify(docsNav, null, 2))

// ---------------------------------------------------------------- guides

// Task walkthroughs that span several packages: site/content/guides/<slug>.md, grouped by nav.json.
const guidesNavFile = JSON.parse(readFileSync(join(site, 'content/guides/nav.json'), 'utf8'))
const guidesNav = []
for (const group of guidesNavFile) {
  const items = []
  for (const slug of group.pages) {
    const path = join(site, 'content/guides', `${slug}.md`)
    const { data, body } = parseFrontmatter(readFileSync(path, 'utf8'))
    if (!data.title || !data.description) throw new Error(`${path}: frontmatter needs title and description`)
    const url = `/guides/${slug}`
    const list = (value) =>
      (value ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    const usesPackages = list(data.packages)
    // The platform types the guide ships to (web, server, desktop, tauri, mobile), for platform pages.
    const platforms = list(data.platforms)
    for (const name of usesPackages)
      if (!packages.some((p) => p.entry.name === name))
        throw new Error(`${path}: "packages" names ${name}, which is not a package`)
    const rendered = await render(body)
    writePage(`guides__${slug}`, {
      url,
      title: data.title,
      description: data.description,
      section: group.title,
      packages: usesPackages,
      platforms,
      time: data.time,
      blocks: rendered.blocks,
      toc: rendered.toc,
      editUrl: `${repoUrl}/edit/main/${relative(repo, path)}`,
    })
    items.push({
      slug,
      title: data.title,
      description: data.description,
      packages: usesPackages,
      platforms,
      time: data.time,
    })
    addSearch(url, data.title, 'Guides', rendered, data.description)
    llms.push({ url, title: data.title, description: data.description, body })
  }
  guidesNav.push({ title: group.title, description: group.description, items })
}
writeFileSync(join(out, 'guides-nav.json'), JSON.stringify(guidesNav, null, 2))
writeFileSync(join(out, 'search.json'), JSON.stringify(search))

// ---------------------------------------------------------------- home page code

const highlight = (code, lang) =>
  highlighter
    .codeToHtml(code, {
      lang,
      themes: { light: 'github-light-high-contrast', dark: 'github-dark' },
      defaultColor: false,
    })
    .replace('<pre ', `<pre data-lang="${lang}" `)
writeFileSync(
  join(out, 'home-code.json'),
  JSON.stringify({
    contract: highlight(
      `// app/features/projects/queries.ts
export const projectsQuery = defineQuery({
  key: () => projectKeys.list(),
  fetch: () => api.projects.index(),
})

export const renameProject = defineMutation({
  mutate: ({ id, name }: { id: string; name: string }) =>
    api.projects.update({ params: { id }, body: { name } }),
  // Every screen showing projects updates. No manual refetching.
  effects: (project) => ({
    set: [{ key: projectKeys.detail(project.id), data: project }],
    invalidate: [projectKeys.lists()],
  }),
})`,
      'ts',
    ),
  }),
)

// ---------------------------------------------------------------- platforms

const platformPages = buildPlatforms({
  repo,
  site,
  out,
  highlight,
  packages,
  docs: llms,
  parseFrontmatter,
})

// ---------------------------------------------------------------- SEO: OG images, sitemap, robots

const base = 'https://kitr.dev'
const catalog = readCatalog(site)
const tileFor = (name, category) => ({
  icon: catalog.glyphs[name] ?? 'Package01Icon',
  color: catalog.colors[category]?.color ?? '#94A3B8',
})
const seoPages = [
  {
    path: '/',
    title: 'One way to build everything',
    description: 'The opinionated TypeScript framework for web, mobile, desktop and backend apps.',
    display: true,
  },
  {
    path: '/packages',
    title: 'Packages',
    description: `${packages.length} packages and platforms, each a single kitr add away.`,
  },
  {
    path: '/guides',
    title: 'Guides',
    description:
      'Step-by-step walkthroughs: build an app, add sign-in and live updates, test and deploy it, write a package, and move to kitr.',
    kind: 'Guides',
  },
  {
    path: '/platforms',
    title: 'Platforms',
    description: 'Web, server, desktop and mobile from one app. Mix them in one project.',
    kind: 'Platforms',
  },
  ...platformPages.map((p) => ({
    path: `/platforms/${p.type}`,
    title: p.type === 'desktop' ? 'Desktop with Electron' : p.name,
    description: p.tagline,
    kind: `Platform · ${p.targets.join(', ')}`,
    tile: { icon: catalog.glyphs[p.type] ?? 'Package01Icon', color: p.color },
  })),
  {
    path: '/about',
    title: 'A box of parts that fit together',
    description: 'Why kitr exists, the ideas behind it, the brand and who makes it.',
    kind: 'About',
  },
]
for (const { entry } of packages) {
  const kind = `Package · ${catalog.colors[entry.category]?.label ?? entry.category}`
  seoPages.push({
    path: `/packages/${entry.name}`,
    title: entry.title,
    description: entry.summary,
    kind,
    tile: tileFor(entry.name, entry.category),
  })
  for (const page of entry.pages.filter((p) => p.slug))
    seoPages.push({
      path: `/packages/${entry.name}/${page.slug}`,
      title: `${entry.title} ${page.title}`,
      description: entry.summary,
      kind,
      tile: tileFor(entry.name, entry.category),
    })
}
for (const group of docsNav)
  for (const item of group.items) {
    const p = llms.find((l) => l.url === `/docs/${item.slug}`)
    seoPages.push({
      path: `/docs/${item.slug}`,
      title: item.title,
      description: p?.description,
      kind: `Docs · ${group.title}`,
    })
  }
for (const group of guidesNav)
  for (const item of group.items)
    seoPages.push({
      path: `/guides/${item.slug}`,
      title: item.title,
      description: item.description,
      kind: `Guide · ${group.title}`,
    })

mkdirSync(join(site, 'public/og'), { recursive: true })
const ogId = (path) => (path === '/' ? 'home' : path.slice(1).replace(/\//g, '-'))
await Promise.all(
  seoPages.map(async (p) =>
    writeFileSync(join(site, 'public/og', `${ogId(p.path)}.png`), await ogImage(p, site)),
  ),
)
writeFileSync(join(site, 'public/apple-touch-icon.png'), await touchIcon(site))

const today = new Date().toISOString().slice(0, 10)
writeFileSync(
  join(site, 'public/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${seoPages
  .map(
    (p) =>
      `  <url><loc>${base}${p.path}</loc><lastmod>${today}</lastmod><priority>${p.path === '/' ? '1.0' : p.path.split('/').length > 3 ? '0.6' : '0.8'}</priority></url>`,
  )
  .join('\n')}
</urlset>
`,
)
writeFileSync(
  join(site, 'public/robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /play/\n\nSitemap: ${base}/sitemap.xml\n`,
)

// ---------------------------------------------------------------- llms.txt

const index = [
  '# kitr',
  '',
  '> One way to build everything. kitr is the opinionated TypeScript framework for web, mobile, desktop and backend apps: a thin layer over TanStack, React Hook Form, Zustand, ky, h3 and Tailwind, with one import surface, one data contract and one CLI.',
  '',
  '## Docs',
  '',
  ...llms
    .filter((p) => p.url.startsWith('/docs'))
    .map((p) => `- [${p.title}](${base}${p.url}.md): ${p.description ?? ''}`),
  '',
  '## Guides',
  '',
  ...llms
    .filter((p) => p.url.startsWith('/guides'))
    .map((p) => `- [${p.title}](${base}${p.url}.md): ${p.description ?? ''}`),
  '',
  '## Packages',
  '',
  ...llms
    .filter((p) => p.url.startsWith('/packages'))
    .map((p) => `- [${p.title}](${base}${p.url}.md): ${p.description ?? ''}`),
  '',
].join('\n')
writeFileSync(join(site, 'public/llms.txt'), index)
// Every page as markdown at <url>.md, for agents and "copy as markdown".
for (const p of llms) {
  const file = join(site, 'public', `${p.url}.md`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(
    file,
    `# ${p.title}\n\n${p.description ?? ''}\n\n${p.body.replace(/^\s*# .*\n/, '').trim()}\n`,
  )
}
writeFileSync(
  join(site, 'public/llms-full.txt'),
  llms
    .map(
      (p) =>
        `# ${p.title}\n\nSource: ${base}${p.url}\n\n${p.body.replace(/^\s*# .*\n/, '').trim()}\n`,
    )
    .join('\n\n'),
)

console.log(
  `kitr.dev content: ${packages.length} packages, ${llms.filter((p) => p.url.startsWith('/packages')).length} package pages, ${docsNav.reduce((n, g) => n + g.items.length, 0)} docs pages, ${search.length} search entries`,
)
