import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineCommand } from 'citty'
import pc from 'picocolors'
import { validateManifest } from '../manifest'

/** Frontmatter keys from a markdown file: the `key: value` lines between leading `---` fences. */
export function readFrontmatter(source: string): Record<string, string> | null {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) return null
  const data: Record<string, string> = {}
  for (const line of match[1]!.split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/)
    if (m) data[m[1]!] = m[2]!.replace(/^['"]|['"]$/g, '')
  }
  return data
}

/** Problems with a package's kitr block and docs folder, for authors before they publish. */
export function checkPackage(dir: string): string[] {
  const file = join(dir, 'package.json')
  if (!existsSync(file)) return ['no package.json here']
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  if (!pkg.kitr)
    return ['package.json has no "kitr" block. See https://kitr.dev/docs/building-packages']
  const errors = validateManifest(pkg.kitr).map((e) => `kitr block: ${e}`)
  if (!pkg.keywords?.includes('kitr-package'))
    errors.push('add "kitr-package" to keywords so the package can be listed on kitr.dev')
  const docs = join(dir, pkg.kitr.docs ?? 'docs')
  if (!existsSync(join(docs, 'index.md'))) {
    errors.push(`${pkg.kitr.docs ?? 'docs'}/index.md is missing`)
    return errors
  }
  if (Array.isArray(pkg.files) && !pkg.files.includes(pkg.kitr.docs ?? 'docs'))
    errors.push(`add "${pkg.kitr.docs ?? 'docs'}" to "files" so the docs are published`)
  for (const name of readdirSync(docs).filter((f) => f.endsWith('.md'))) {
    const fm = readFrontmatter(readFileSync(join(docs, name), 'utf8'))
    if (!fm) {
      errors.push(`docs/${name}: missing frontmatter`)
      continue
    }
    for (const key of ['title', 'description'])
      if (!fm[key]) errors.push(`docs/${name}: frontmatter needs "${key}"`)
    if (name === 'index.md' && fm.description !== pkg.kitr.summary)
      errors.push('docs/index.md: description must match the kitr summary')
  }
  return errors
}

export const packageCheck = defineCommand({
  meta: {
    name: 'package:check',
    description: "Check a kitr package's manifest and docs before publishing.",
  },
  args: {
    dir: { type: 'positional', required: false, description: 'Package folder (default: .)' },
  },
  run({ args }) {
    const errors = checkPackage(resolve(args.dir ?? '.'))
    for (const e of errors) console.error(`${pc.red('✗')} ${e}`)
    if (errors.length) process.exit(1)
    console.log(`${pc.green('✓')} manifest and docs look good`)
  },
})
