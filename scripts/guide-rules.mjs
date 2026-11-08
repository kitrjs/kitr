// Usage: node scripts/guide-rules.mjs [--strict] [slugs...]
// Checks every site guide (site/content/guides/<slug>.md) against the "Writing guides" rules in
// docs/STYLE.md: frontmatter, listed in nav.json, "Before you start" first and "Next steps" last,
// enough prose and code, no placeholder names, and links that resolve to a real package, doc or
// guide. Prints warnings; --strict turns them into a failing exit code.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const only = new Set(args.filter((a) => !a.startsWith('--')))

export const MIN_WORDS = 1000
export const MIN_CODE_BLOCKS = 10
export const PLACEHOLDERS =
  /\b(foo|baz|qux|quux|asdf|lorem ipsum|MyComponent|doSomething)\b|[`./]bar\b|\bbar[(:`]|test@test\.com/i

const dir = 'site/content/guides'
const docsDir = 'site/content/docs'

const frontmatter = (src) => {
  const m = src.match(/^---\n([\s\S]*?)\n---\n/)
  if (!m) return null
  return Object.fromEntries(
    m[1]
      .split('\n')
      .map((line) => line.match(/^(\w+):\s*(.*)$/))
      .filter(Boolean)
      .map((x) => [x[1], x[2].trim()]),
  )
}
const stripCode = (src) => src.replace(/```[\s\S]*?```/g, '')
const words = (src) => stripCode(src).split(/\s+/).filter(Boolean).length
const codeBlocks = (src) => (src.match(/^```/gm) ?? []).length / 2

const packages = new Set(
  readdirSync('packages')
    .map((d) => join('packages', d, 'package.json'))
    .filter(existsSync)
    .map((f) => JSON.parse(readFileSync(f, 'utf8')).kitr?.name)
    .filter(Boolean),
)
const docs = new Set([
  ...readdirSync(docsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3)),
  ...JSON.parse(readFileSync(join(docsDir, 'nav.json'), 'utf8')).flatMap((g) =>
    g.pages.map((p) => p.slug),
  ),
])
const nav = JSON.parse(readFileSync(join(dir, 'nav.json'), 'utf8'))
const listed = new Set(nav.flatMap((g) => g.pages))
const guides = new Set(
  readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3)),
)

const report = []
for (const slug of listed)
  if (!guides.has(slug)) report.push([slug, `listed in nav.json but ${dir}/${slug}.md is missing`])

for (const slug of [...guides].sort()) {
  if (only.size && !only.has(slug)) continue
  const problems = []
  const src = readFileSync(join(dir, `${slug}.md`), 'utf8')
  const fm = frontmatter(src)
  if (!fm) problems.push('missing frontmatter')
  else
    for (const key of ['title', 'description', 'time'])
      if (!fm[key]) problems.push(`frontmatter needs "${key}"`)
  if (fm?.preview) problems.push('"preview" is gone from the frontmatter: every package ships')
  for (const name of (fm?.packages ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean))
    if (!packages.has(name)) problems.push(`frontmatter lists unknown package "${name}"`)
  if (!listed.has(slug)) problems.push('not listed in nav.json')

  const h2 = [...src.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim())
  if (h2[0] !== 'Before you start') problems.push('the first section must be "Before you start"')
  if (h2.at(-1) !== 'Next steps') problems.push('the last section must be "Next steps"')
  const generic = h2.find((h) => /^(usage|advanced|misc|other|overview|introduction)$/i.test(h))
  if (generic)
    problems.push(`"${generic}" is not a task; name the section after what the reader does`)

  const w = words(src)
  const c = codeBlocks(src)
  if (w < MIN_WORDS) problems.push(`${w} words, needs ${MIN_WORDS}`)
  if (c < MIN_CODE_BLOCKS) problems.push(`${c} code blocks, needs ${MIN_CODE_BLOCKS}`)

  const ph = src.match(PLACEHOLDERS)
  if (ph) problems.push(`placeholder name "${ph[0]}"`)
  if (/from 'kitr\/(?!app'|env')[\w-]+/.test(src))
    problems.push("app code imports from 'kitr/<name>'; packages are imported as '@kitr/<name>'")

  const href = src.match(/href="\/(?!packages\/|docs\/|guides\/)[^"]*"/)
  if (href) problems.push(`${href[0]} would be crawled as a site page; use <Link to> or a full URL`)

  const prose = stripCode(src)
  for (const [, name] of prose.matchAll(/\]\(\/packages\/([^)/#]+)/g))
    if (!packages.has(name)) problems.push(`links to unknown package "${name}"`)
  for (const [, page] of prose.matchAll(/\]\(\/docs\/([^)/#]+)/g))
    if (!docs.has(page)) problems.push(`links to unknown doc "/docs/${page}"`)
  for (const [, page] of prose.matchAll(/\]\(\/guides\/([^)/#]+)/g))
    if (!guides.has(page)) problems.push(`links to unknown guide "/guides/${page}"`)
    else if (!listed.has(page))
      problems.push(`links to "/guides/${page}", which is not in nav.json`)

  for (const p of problems) report.push([slug, p])
}

for (const [slug, p] of report) console[strict ? 'error' : 'warn'](`${slug}: ${p}`)
const failing = new Set(report.map(([slug]) => slug)).size
console.log(
  `${guides.size - failing} of ${guides.size} guides follow the guide rules in docs/STYLE.md`,
)
if (strict && report.length) process.exit(1)
