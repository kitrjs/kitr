import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { defineCommand } from 'citty'
import semver from 'semver'
import { createContext } from '../context'
import { versions } from '../versions'

/**
 * Bump every kitr package to one version, then move upstream libraries to the set that
 * version was tested with. Upstream bumps that cross a major are listed, not applied,
 * unless --majors is passed.
 */
export const upgrade = defineCommand({
  meta: {
    name: 'upgrade',
    description:
      'Upgrade kitr and @kitr/* together, and align upstream libraries with the tested versions.',
  },
  args: {
    to: { type: 'string', description: "kitr version to move to (default: the CLI's own)" },
    majors: { type: 'boolean', description: 'Also apply upstream major bumps', default: false },
    install: { type: 'boolean', default: true },
    'dry-run': { type: 'boolean', default: false },
  },
  run({ args }) {
    const ctx = createContext({ dryRun: args['dry-run'] })
    const pkgPath = ctx.path('package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    const target = args.to ?? ctx.kitrVersion
    const changes: string[] = []
    const skipped: string[] = []
    for (const bucket of ['dependencies', 'devDependencies'] as const) {
      const deps: Record<string, string> = pkg[bucket] ?? {}
      for (const [name, current] of Object.entries(deps)) {
        if (current.startsWith('workspace:')) continue
        if (name === 'kitr' || name.startsWith('@kitr/')) {
          const next = `^${target}`
          if (current !== next) {
            deps[name] = next
            changes.push(`${name}: ${current} → ${next}`)
          }
          continue
        }
        const wanted = versions[name]
        if (!wanted || current === wanted) continue
        const curMin = semver.minVersion(current)
        const wantMin = semver.minVersion(wanted)
        const crossesMajor = curMin && wantMin && curMin.major !== wantMin.major
        if (crossesMajor && !args.majors) {
          skipped.push(`${name}: ${current} → ${wanted} (major; pass --majors)`)
          continue
        }
        if (curMin && wantMin && semver.gt(curMin, wantMin)) continue
        deps[name] = wanted
        changes.push(`${name}: ${current} → ${wanted}`)
      }
    }
    ctx.log.title(`Upgrading to kitr ${target}`)
    if (!changes.length) ctx.log.success('Already up to date')
    for (const c of changes) ctx.log.step(c)
    for (const s of skipped) ctx.log.warn(s)
    if (changes.length && !ctx.dryRun) {
      writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
      if (args.install) {
        ctx.log.step(`${ctx.pm} install`)
        execSync(`${ctx.pm} install`, { cwd: ctx.root, stdio: 'inherit' })
      }
      ctx.log.info(
        'Run `kitr doctor` and your typecheck. Breaking changes between kitr versions are listed in CHANGELOG.md of each package.',
      )
    }
  },
})
