// Which dependency ranges changed in the working tree compared with HEAD, one line per change:
//
//   typescript: ^5.9.3 -> ^7.0.2  (examples/backend, examples/blank, packages/cli ...)
//
// Used by the nightly canary to say what `pnpm update --latest --recursive` moved. A package that
// was added or removed is listed too; `workspace:` links are left out.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: 'pipe' })
const fields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
const changes = new Map()

for (const file of git('ls-files', '*package.json').split('\n').filter(Boolean)) {
  if (!existsSync(file)) continue
  let before
  try {
    before = JSON.parse(git('show', `HEAD:${file}`))
  } catch {
    continue
  }
  const after = JSON.parse(readFileSync(file, 'utf8'))
  const where = file.replace(/\/?package\.json$/, '') || '.'
  for (const field of fields) {
    const names = new Set([...Object.keys(before[field] ?? {}), ...Object.keys(after[field] ?? {})])
    for (const name of names) {
      const a = before[field]?.[name]
      const b = after[field]?.[name]
      if (a === b || a?.startsWith('workspace:') || b?.startsWith('workspace:')) continue
      const key = `${name}: ${a ?? '(none)'} -> ${b ?? '(removed)'}`
      if (!changes.has(key)) changes.set(key, new Set())
      changes.get(key).add(where)
    }
  }
}

for (const [key, places] of [...changes].sort(([a], [b]) => a.localeCompare(b))) {
  const list = [...places].sort()
  console.log(
    `${key}  (${list.length > 4 ? `${list.slice(0, 4).join(', ')} and ${list.length - 4} more` : list.join(', ')})`,
  )
}
if (!changes.size) console.log('(no dependency range changed)')
