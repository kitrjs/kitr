// Usage: node scripts/package-readmes.mjs [--check]
// Writes packages/<dir>/README.md for every published package (not "private"), from its
// package.json: the README is what npm shows on the package page. The guide itself lives in
// the package's docs/ folder and on kitr.dev. --check fails when a README is missing or stale.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const check = process.argv.includes('--check')
const stale = []
for (const dir of readdirSync('packages').sort()) {
  const file = join('packages', dir, 'package.json')
  if (!existsSync(file)) continue
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  if (pkg.private) continue
  const k = pkg.kitr ?? {}
  const title = k.title ?? pkg.name
  const summary = k.summary ?? pkg.description ?? ''
  const isKit = k.kind === 'kit'
  const isPlatform = k.kind === 'platform'
  const install =
    pkg.name === 'kitr' || pkg.name === '@kitr/cli'
      ? 'pnpm dlx kitr new my-app'
      : !k.name
        ? `pnpm add ${pkg.name}`
        : isKit
          ? `pnpm dlx kitr new my-app --kit ${k.name}`
          : isPlatform
            ? `pnpm kitr add ${k.name} <name>`
            : k.included
              ? `pnpm add ${pkg.name}`
              : `pnpm kitr add ${k.name}`
  const lines = [
    `# ${pkg.name}`,
    '',
    k.title ? `**${title}.** ${summary}` : summary,
    '',
    '```sh',
    install,
    '```',
    '',
  ]
  if (!isKit && !k.included && k.name)
    lines.push(
      `\`kitr add\` installs the package and wires it into your app: the provider in \`kitrrc.ts\`, its config file and its \`AGENTS.md\` section. Import it from \`kitr/${k.name}\`.`,
      '',
    )
  if (k.builtOn?.length) lines.push(`Built on ${k.builtOn.join(', ')}.`, '')
  lines.push(
    `Read the guide at ${pkg.homepage ?? 'https://kitr.dev'}.`,
    '',
    `Part of [kitr](https://kitr.dev), the TypeScript framework where everything is an add-on. MIT licensed.`,
    '',
  )
  const body = lines.join('\n')
  const out = join('packages', dir, 'README.md')
  if (check) {
    if (!existsSync(out) || readFileSync(out, 'utf8') !== body) stale.push(out)
  } else writeFileSync(out, body)
}
if (check && stale.length) {
  console.error(`Stale or missing READMEs (run: pnpm readmes):\n  ${stale.join('\n  ')}`)
  process.exit(1)
}
console.log(check ? 'READMEs in sync' : 'Wrote package READMEs')
