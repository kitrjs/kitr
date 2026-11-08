// Usage: node scripts/docs-rules.mjs [--strict] [--gaps] [names...]
// Checks every package guide (docs/index.md) against docs/STYLE.md: the required sections in
// order, a config table, enough worked code, no placeholder names, and a doc comment on every
// export in api.md. Prints warnings; --strict turns them into a failing exit code. --gaps prints
// the per-package gap table in Markdown (the appendix of docs/STYLE.md is generated from it).
// Pass package names to check only those.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const gaps = args.includes('--gaps')
const only = new Set(args.filter((a) => !a.startsWith('--')))

/** Sections every guide needs, in this order. Install, Configure and Testing are exact names. */
export const REQUIRED = ['Install', 'Configure', 'Testing', 'Next steps']
export const MIN_WORDS = 600
export const MIN_CODE_BLOCKS = 8
/** A table cell is one short sentence and at most one example. Detail goes in a section below. */
export const MAX_CELL_WORDS = 30
// "bar" alone is a real word (title bar, status bar), so it only counts as code or next to foo.
export const PLACEHOLDERS = /\b(foo|baz|qux|quux|asdf|lorem ipsum)\b|[`./]bar\b|\bbar[(:`]/i

const pkgs = readdirSync('packages')
  .map((dir) => ({ dir, file: join('packages', dir, 'package.json') }))
  .filter(({ file }) => existsSync(file))
  .map(({ dir, file }) => ({ dir, pkg: JSON.parse(readFileSync(file, 'utf8')) }))
  .filter(({ pkg }) => pkg.kitr && (!only.size || only.has(pkg.kitr.name)))
  // Kits are documented together in docs/kits.md, not one guide each.
  .filter(({ pkg }) => pkg.kitr.kind !== 'kit')

const headings = (src) =>
  [...src.matchAll(/^(#{2,3}) (.+)$/gm)].map((m) => ({ depth: m[1].length, text: m[2].trim() }))
const stripCode = (src) => src.replace(/```[\s\S]*?```/g, '')
const words = (src) => stripCode(src).split(/\s+/).filter(Boolean).length
const codeBlocks = (src) => (src.match(/^```/gm) ?? []).length / 2
const section = (src, name) => {
  const m = src.match(new RegExp(`^## ${name}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'))
  return m ? m[1] : null
}

/** Table cells (outside code blocks) longer than MAX_CELL_WORDS, as "line N" labels. */
export const longCells = (src) => {
  const found = []
  let fenced = false
  for (const [i, line] of src.split('\n').entries()) {
    if (line.startsWith('```')) fenced = !fenced
    if (fenced || !line.startsWith('|')) continue
    const cells = line.split(/(?<!\\)\|/).slice(1, -1)
    if (cells.some((cell) => cell.trim().split(/\s+/).length > MAX_CELL_WORDS))
      found.push(`line ${i + 1}`)
  }
  return found
}
const longCellProblem = (src) => {
  const lines = longCells(src)
  return lines.length
    ? `table cells over ${MAX_CELL_WORDS} words (${lines.slice(0, 4).join(', ')}${lines.length > 4 ? ', …' : ''}); keep one sentence and move detail below the table`
    : null
}

const rows = []
let failures = 0
let pageFailures = 0
for (const { dir, pkg } of pkgs) {
  const docsDir = join('packages', dir, pkg.kitr.docs ?? 'docs')
  const guide = join(docsDir, 'index.md')
  const problems = []
  if (!existsSync(guide)) {
    problems.push('no guide')
    rows.push({ name: pkg.kitr.name, words: 0, code: 0, problems })
    failures += 1
    continue
  }
  const src = readFileSync(guide, 'utf8')
  const h2 = headings(src)
    .filter((h) => h.depth === 2)
    .map((h) => h.text)

  // Required sections, in order.
  const missing = REQUIRED.filter((r) => !h2.includes(r))
  if (missing.length) problems.push(`missing sections: ${missing.join(', ')}`)
  const present = REQUIRED.filter((r) => h2.includes(r)).map((r) => h2.indexOf(r))
  if (present.some((idx, i) => i && idx < present[i - 1])) problems.push('sections out of order')

  // A package that ships commands or generators documents them.
  const setup = join('packages', dir, 'src', 'kitr.ts')
  if (existsSync(setup)) {
    const s = readFileSync(setup, 'utf8')
    if (/^\s*(commands|generators)\s*[:(]/m.test(s) && !h2.includes('Commands'))
      problems.push('ships commands or generators but has no "Commands" section')
    // Every question is a flag (`--worker` / `--no-worker`); Install shows each one.
    const qs = s.match(/^\s*questions\s*:\s*\[([\s\S]*?)^\s*\],?\s*$/m)?.[1] ?? ''
    const install = section(src, 'Install') ?? ''
    for (const [, q] of qs.matchAll(/^\s{4,6}name:\s*'([\w-]+)'/gm))
      if (!install.includes(`--${q}`) && !install.includes(`--no-${q}`))
        problems.push(`asks "${q}" on add but the Install section doesn't show --${q}`)
  }

  // Configure: full config file plus the options table.
  const configure = section(src, 'Configure')
  if (configure !== null) {
    // A package with no config file says so and documents the options of its entry point instead.
    const noConfigFile = /has no config file/.test(configure)
    if (!noConfigFile && !/```tsx?\n\/\/ config\//.test(configure))
      problems.push('Configure has no `// config/<name>.ts` code block')
    if (noConfigFile && !/```/.test(configure)) problems.push('Configure has no code')
    if (!/^\| Option \| Default \|/m.test(configure))
      problems.push('Configure has no "| Option | Default | Description |" table')
  }

  // Depth.
  const w = words(src)
  const c = codeBlocks(src)
  if (w < MIN_WORDS) problems.push(`${w} words, needs ${MIN_WORDS}`)
  if (c < MIN_CODE_BLOCKS) problems.push(`${c} code blocks, needs ${MIN_CODE_BLOCKS}`)

  // Placeholders.
  const ph = src.match(PLACEHOLDERS)
  if (ph) problems.push(`placeholder name "${ph[0]}"`)

  // The site's prerender crawler follows href="/..." even inside code blocks, and fails on a 404.
  const href = src.match(/href="\/(?!packages\/|docs\/)[^"]*"/)
  if (href) problems.push(`${href[0]} would be crawled as a site page; use <Link to> or a full URL`)

  // Short table cells.
  const long = longCellProblem(src)
  if (long) problems.push(long)

  // Testing section shows real code.
  const testing = section(src, 'Testing')
  if (testing !== null && !/```/.test(testing)) problems.push('Testing section has no code')

  // api.md: every export has a sentence under its signature.
  const api = join(docsDir, 'api.md')
  if (existsSync(api)) {
    const a = readFileSync(api, 'utf8')
    const bare = [
      ...a.matchAll(/^### (\S+)\n\n```ts\n(?:(?!```)[\s\S])*```\n\n(?=###|## |$)/gm),
    ].map((m) => m[1])
    if (bare.length)
      problems.push(
        `api.md: ${bare.length} export(s) without a doc comment (${bare.slice(0, 4).join(', ')}${bare.length > 4 ? ', …' : ''})`,
      )
  }

  rows.push({ name: pkg.kitr.name, words: w, code: c, problems })
  if (problems.length) failures += 1
}

// The reference pages and site docs follow the same table rule.
if (!only.size) {
  const pages = [
    ...readdirSync('docs')
      .filter((f) => f.endsWith('.md') && f !== 'STYLE.md')
      .map((f) => join('docs', f)),
    ...readdirSync(join('site', 'content', 'docs'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => join('site', 'content', 'docs', f)),
  ]
  for (const file of pages) {
    const long = longCellProblem(readFileSync(file, 'utf8'))
    if (!long) continue
    pageFailures += 1
    if (strict) console.error(`${file}: ${long}`)
    else console.warn(`${file}: ${long}`)
  }
}

if (gaps) {
  console.log('| Package | Words | Code blocks | Gaps |')
  console.log('| --- | --- | --- | --- |')
  for (const r of rows)
    console.log(`| ${r.name} | ${r.words} | ${r.code} | ${r.problems.join('; ') || 'none'} |`)
} else {
  for (const r of rows) {
    if (!r.problems.length) continue
    if (strict) for (const p of r.problems) console.error(`${r.name}: ${p}`)
    else console.warn(`${r.name}: ${r.problems.length} gap(s), first: ${r.problems[0]}`)
  }
  console.log(`${pkgs.length - failures} of ${pkgs.length} package guides follow docs/STYLE.md`)
}
if (strict && (failures || pageFailures)) process.exit(1)
