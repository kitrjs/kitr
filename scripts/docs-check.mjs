// Usage: node scripts/docs-check.mjs [--strict]
// Checks every package's docs folder: frontmatter, the overview matching the manifest summary,
// and links between package pages. --strict also fails when a package has no docs yet.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const strict = process.argv.includes('--strict')
const errors = []
const missing = []
const pkgs = readdirSync('packages')
  .map((dir) => ({ dir, file: join('packages', dir, 'package.json') }))
  .filter(({ file }) => existsSync(file))
  .map(({ dir, file }) => ({ dir, pkg: JSON.parse(readFileSync(file, 'utf8')) }))
  .filter(({ pkg }) => pkg.kitr)
const names = new Set(pkgs.map(({ pkg }) => pkg.kitr.name))

export function frontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) return null
  const data = {}
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/)
    if (m) data[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return data
}

for (const { dir, pkg } of pkgs) {
  const docsDir = join('packages', dir, pkg.kitr.docs ?? 'docs')
  if (!existsSync(join(docsDir, 'index.md'))) {
    missing.push(pkg.kitr.name)
    continue
  }
  for (const file of readdirSync(docsDir).filter((f) => f.endsWith('.md'))) {
    const where = join(docsDir, file)
    const source = readFileSync(where, 'utf8')
    const fm = frontmatter(source)
    if (!fm) {
      errors.push(`${where}: missing frontmatter`)
      continue
    }
    for (const key of ['title', 'description'])
      if (!fm[key]) errors.push(`${where}: frontmatter needs "${key}"`)
    if (file === 'index.md' && fm.description !== pkg.kitr.summary)
      errors.push(`${where}: description must match the kitr summary in package.json`)
    for (const [, target] of source.matchAll(/\]\(\/packages\/([^)/#]+)/g))
      if (!names.has(target)) errors.push(`${where}: links to unknown package "${target}"`)
    for (const [, target, page] of source.matchAll(/\]\(\/packages\/([^)/#]+)\/([^)#]+)/g)) {
      const other = pkgs.find(({ pkg: p }) => p.kitr.name === target)
      if (
        other &&
        !existsSync(join('packages', other.dir, other.pkg.kitr.docs ?? 'docs', `${page}.md`))
      )
        errors.push(`${where}: links to missing page /packages/${target}/${page}`)
    }
  }
}

if (missing.length) console[strict ? 'error' : 'warn'](`No docs yet: ${missing.join(', ')}`)
for (const e of errors) console.error(e)
if (errors.length || (strict && missing.length)) process.exit(1)
console.log(`Docs OK for ${pkgs.length - missing.length} of ${pkgs.length} packages`)
