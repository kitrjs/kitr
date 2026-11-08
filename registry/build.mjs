// Builds dist/registry.json plus one dist/<name>.json per item, in shadcn's registry-item format.
// Layout mirrors a consuming app: src/components/ui/<name>.tsx, src/routes/<file>.tsx; metadata in src/items/<name>.json.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const src = join(root, 'src')
const dist = join(root, 'dist')
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

const items = []
for (const file of readdirSync(join(src, 'items')).sort()) {
  const name = file.replace(/\.json$/, '')
  const meta = JSON.parse(readFileSync(join(src, 'items', file), 'utf8'))
  const type = meta.type ?? 'registry:ui'
  const sources = meta.files ?? [`${name}.tsx`]
  const files = sources.map((f) => {
    const from =
      type === 'registry:page' ? join(src, 'routes', f) : join(src, 'components', 'ui', f)
    const path = type === 'registry:page' ? `app/routes/${f}` : `app/components/ui/${f}`
    return { path, type, target: meta.targets?.[f] ?? path, content: readFileSync(from, 'utf8') }
  })
  const item = {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    name,
    type,
    title: meta.title ?? name,
    description: meta.description ?? '',
    dependencies: meta.dependencies ?? [],
    registryDependencies: meta.registryDependencies ?? [],
    files,
  }
  writeFileSync(join(dist, `${name}.json`), JSON.stringify(item, null, 2))
  items.push({
    name,
    type,
    title: item.title,
    description: item.description,
    registryDependencies: item.registryDependencies,
    dependencies: item.dependencies,
  })
}
writeFileSync(
  join(dist, 'registry.json'),
  JSON.stringify(
    {
      $schema: 'https://ui.shadcn.com/schema/registry.json',
      name: 'kitr',
      homepage: 'https://kitr.dev',
      items,
    },
    null,
    2,
  ),
)
console.log(`registry: ${items.length} items`)
