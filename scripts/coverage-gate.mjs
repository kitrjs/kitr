// Fails when a package's line coverage is under its floor.
//
//   pnpm test:coverage && pnpm coverage:gate
//
// Reads coverage/coverage-summary.json (written by `vitest run --coverage`) and the floors in
// coverage.floors.json at the repo root:
//
//   {
//     "default": 80,                        the floor for every package not listed below
//     "packages": {
//       "desktop": { "floor": 60, "reason": "Electron main process, run by Electron" }
//     }
//   }
//
// A package under 80% is listed with the floor it was held at when the gate was added, and a
// reason. Raise a floor when a package improves (the table marks packages whose coverage is well
// above it); never lower one without writing down why. Packages with no source lines in the
// report (the kits, which are generated files and markdown) are shown and skipped.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const summaryFile = join(root, 'coverage/coverage-summary.json')
const floorsFile = join(root, 'coverage.floors.json')

if (!existsSync(summaryFile)) {
  console.error(
    'coverage-gate: coverage/coverage-summary.json is missing; run `pnpm test:coverage` first.',
  )
  process.exit(2)
}

const config = JSON.parse(readFileSync(floorsFile, 'utf8'))
const fallback = config.default
const exceptions = config.packages ?? {}
if (typeof fallback !== 'number') {
  console.error('coverage-gate: coverage.floors.json needs a numeric "default".')
  process.exit(2)
}

const packagesDir = join(root, 'packages')
const names = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const totals = new Map(names.map((name) => [name, { covered: 0, total: 0 }]))
for (const [file, entry] of Object.entries(JSON.parse(readFileSync(summaryFile, 'utf8')))) {
  if (file === 'total') continue
  const [name] = relative(packagesDir, file).split(sep)
  const bucket = totals.get(name)
  if (!bucket) continue
  bucket.covered += entry.lines.covered
  bucket.total += entry.lines.total
}

for (const name of Object.keys(exceptions)) {
  if (!totals.has(name)) {
    console.error(`coverage-gate: coverage.floors.json lists "${name}", which is not a package.`)
    process.exit(2)
  }
  if (typeof exceptions[name].floor !== 'number' || !exceptions[name].reason) {
    console.error(`coverage-gate: "${name}" needs a numeric floor and a reason.`)
    process.exit(2)
  }
}

const rows = names.map((name) => {
  const { covered, total } = totals.get(name)
  const floor = exceptions[name]?.floor ?? fallback
  const pct = total === 0 ? null : Math.floor((covered / total) * 1000) / 10
  const failed = pct !== null && pct < floor
  const raise =
    pct !== null && !failed && exceptions[name]?.reason.startsWith('behind') && pct >= floor + 5
  return { name, covered, total, pct, floor, failed, raise, reason: exceptions[name]?.reason }
})

const width = Math.max(...rows.map((row) => row.name.length), 7)
const line = (cells) =>
  `${cells[0].padEnd(width)}  ${cells[1].padStart(11)}  ${cells[2].padStart(6)}  ${cells[3].padStart(5)}  ${cells[4]}`
console.log(line(['package', 'lines', 'cover', 'floor', '']))
for (const row of rows) {
  const status =
    row.pct === null
      ? 'no source lines'
      : row.failed
        ? 'FAIL'
        : row.raise
          ? 'ok (raise the floor)'
          : 'ok'
  console.log(
    line([
      row.name,
      row.total === 0 ? '-' : `${row.covered}/${row.total}`,
      row.pct === null ? '-' : `${row.pct.toFixed(1)}%`,
      `${row.floor}%`,
      status,
    ]),
  )
}

const below = rows.filter((row) => row.pct !== null && row.pct < 80)
console.log(
  `\n${below.length} package(s) under 80%: ${below.map((row) => row.name).join(', ') || 'none'}`,
)

const failures = rows.filter((row) => row.failed)
if (failures.length) {
  console.error(`\ncoverage-gate: ${failures.length} package(s) under their floor:`)
  for (const row of failures)
    console.error(
      `  ${row.name}: ${row.pct.toFixed(1)}% < ${row.floor}%${row.reason ? ` (${row.reason})` : ''}`,
    )
  process.exit(1)
}
console.log('coverage-gate: every package is at or above its floor.')
