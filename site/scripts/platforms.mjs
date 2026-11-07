// Builds app/generated/platforms.json from content/platforms.mjs plus what the repo knows:
// which packages run on each platform, whether a platform or kit package is published
// (`"private": true` in its package.json means not yet), and which guides cover it.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { builder, platforms } from '../content/platforms.mjs'

const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null)

/** `web, server` or `[web, server]` → ['web', 'server']. */
const list = (value) =>
  String(value ?? '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)

/** Shiki output split into one HTML string per line, keeping the <pre> tag. */
function splitLines(html) {
  const pre = html.match(/^<pre[^>]*>/)[0]
  const inner = html
    .slice(pre.length)
    .replace(/^<code>/, '')
    .replace(/<\/code><\/pre>$/, '')
  return { pre, lines: inner.split('\n') }
}

export function buildPlatforms({ repo, site, out, highlight, packages, docs, parseFrontmatter }) {
  const manifest = (dir) => readJson(join(repo, 'packages', dir, 'package.json'))
  const isPrivate = (dir) => manifest(dir)?.private === true
  // Packages kept out of npm for now are left off the platform pages until they ship.
  const unpublished = packages.filter((p) => isPrivate(p.dir)).map((p) => p.entry.name)
  const published = packages.filter((p) => !isPrivate(p.dir)).map((p) => p.entry)

  // Guides: site/content/guides/*.md with a `platforms:` line, once that section exists;
  // until then, the docs guides named in content/platforms.mjs.
  const guidesDir = join(site, 'content/guides')
  const guides = existsSync(guidesDir)
    ? readdirSync(guidesDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => {
          const { data } = parseFrontmatter(readFileSync(join(guidesDir, f), 'utf8'))
          return {
            slug: f.replace(/\.md$/, ''),
            title: data.title,
            description: data.description,
            platforms: list(data.platforms),
            order: data.order ?? 999,
          }
        })
        .filter((g) => g.title)
    : []
  const docsItems = docs
    .filter((d) => d.url.startsWith('/docs/'))
    .map((d) => ({ ...d, slug: d.url.slice('/docs/'.length) }))

  const result = platforms.map((p) => {
    const sides = p.side === 'server' ? ['server', 'both'] : ['client', 'both']
    const eligible = published.filter(
      (e) =>
        e.kind !== 'platform' &&
        e.kind !== 'kit' &&
        !e.included &&
        sides.includes(e.runsOn) &&
        !p.exclude.includes(e.name),
    )
    const native = p.native.filter((n) => eligible.some((e) => e.name === n))
    const ownPkg = packages.find((x) => x.entry.name === p.type && x.entry.kind === 'platform')
    const own = ownPkg?.entry
    const platformGuides = guides.length
      ? guides
          .filter((g) => g.platforms.includes(p.type))
          .sort((a, b) => a.order - b.order)
          .map((g) => ({ title: g.title, description: g.description, url: `/guides/${g.slug}` }))
      : p.guides
          .map((slug) => docsItems.find((i) => i.slug === slug))
          .filter(Boolean)
          .map((i) => ({ title: i.title, description: i.description, url: `/docs/${i.slug}` }))
    return {
      ...p,
      code: highlight(p.code, p.code.includes('</') ? 'tsx' : 'ts'),
      available: ownPkg ? !isPrivate(ownPkg.dir) : false,
      summary: own?.summary ?? p.tagline,
      packages: {
        native,
        other: eligible.filter((e) => !native.includes(e.name)).map((e) => e.name),
      },
      kits: p.kits.map((name) => ({ name, available: !isPrivate(`kit-${name}`) })),
      docs: (own?.pages ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((page) => ({
          title: page.slug
            ? page.slug === 'api'
              ? 'API reference'
              : page.title
            : 'Platform guide',
          url: page.slug ? `/packages/${p.type}/${page.slug}` : `/packages/${p.type}`,
          description:
            page.slug === 'api'
              ? 'Every export, with its types.'
              : page.slug
                ? ''
                : 'Install, configure, run and ship.',
        })),
      guides: platformGuides,
    }
  })

  // The kitrrc.ts the mix-and-match builder shows, one highlighted line per entry.
  const source = [
    ['// kitrrc.ts', null],
    ["import { defineKitrConfig } from 'kitr/app'", null],
    ...['desktop', 'mobile', 'server', 'tauri', 'web'].map((t) => [
      `import { ${t} } from 'kitr/${t}'`,
      { type: t },
    ]),
    ['', null],
    ['export default defineKitrConfig({', null],
    ['  platforms: {', null],
    ...builder.choices.map((c) => [`    ${c.line}`, { id: c.id }]),
    ['  },', null],
    ['})', null],
  ]
  const { pre, lines } = splitLines(highlight(source.map(([l]) => l).join('\n'), 'ts'))
  const builderOut = {
    pre,
    lines: source.map(([, show], i) => ({ html: lines[i], ...(show ?? {}) })),
    choices: builder.choices.map((c) => ({
      ...c,
      available: result.find((p) => p.type === c.type)?.available ?? false,
    })),
  }

  writeFileSync(
    join(out, 'platforms.json'),
    JSON.stringify({ platforms: result, builder: builderOut, unpublished }, null, 2),
  )
  return result
}
