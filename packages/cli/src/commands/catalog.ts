import { defineCommand } from 'citty'
import pc from 'picocolors'
import { cliVersion } from '../context'
import type { KitrCatalog, KitrCatalogEntry } from '../manifest'
import { kitManifests, manifests } from '../manifests.gen'

const byName = (a: KitrCatalogEntry, b: KitrCatalogEntry) => a.name.localeCompare(b.name)

/** Every official package, platform and kit, from the manifests this CLI was built with. */
export function buildCatalog(): KitrCatalog {
  const all = Object.values(manifests).sort(byName)
  return {
    version: cliVersion(),
    packages: all.filter((m) => m.kind !== 'platform'),
    platforms: all.filter((m) => m.kind === 'platform'),
    kits: Object.values(kitManifests).sort(byName),
  }
}

export const catalog = defineCommand({
  meta: {
    name: 'catalog',
    description:
      'List the official packages, platforms and kits. --json prints each with its whole kitr block, for a site build or a script.',
  },
  args: {
    json: { type: 'boolean', description: 'Print the catalog as JSON' },
  },
  run({ args }) {
    const data = buildCatalog()
    if (args.json) {
      console.log(JSON.stringify(data, null, 2))
      return
    }
    const width = Math.max(
      ...[...data.packages, ...data.platforms, ...data.kits].map((m) => m.name.length),
    )
    const section = (title: string, entries: KitrCatalogEntry[]) => {
      console.log(`\n${pc.bold(title)}`)
      for (const m of entries) console.log(`  ${m.name.padEnd(width)}  ${pc.dim(m.summary)}`)
    }
    section('Platforms (kitr add <type> <name>)', data.platforms)
    section('Packages (kitr add <name>)', data.packages)
    section('Kits (kitr new <dir> --kit <name>)', data.kits)
  },
})
