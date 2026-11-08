import { Link } from '@tanstack/react-router'
import {
  categories,
  glyph,
  type PackageEntry,
  type PlannedEntry,
  plannedStatus,
  type RunsOn,
  runsOn,
} from '#app/lib/catalog'
import { creditsFor } from '#app/lib/upstream'
import { CreatorMark } from './creator-marks'
import { Icon } from './icons'

export function Tile({
  pkg,
  size = 44,
}: {
  pkg: Pick<PackageEntry, 'name' | 'category'>
  size?: number
}) {
  return (
    <span
      className="tile"
      style={{ width: size, height: size, background: categories[pkg.category].color }}
    >
      <Icon
        icon={glyph(pkg.name)}
        size={Math.round(size * 0.55)}
        stroke="#0B121C"
        strokeWidth={1.6}
      />
    </span>
  )
}

export function CategoryBadge({ category }: { category: PackageEntry['category'] }) {
  return (
    <span className="badge" style={{ background: categories[category].color }}>
      {categories[category].label}
    </span>
  )
}

/**
 * Where a package runs: a tinted Client or Server badge. Packages that run on both get one badge
 * with a Client half and a Server half that meet on a diagonal seam between the words.
 */
export function RunsOnBadge({ value }: { value: RunsOn }) {
  if (value === 'both')
    return (
      <span className="badge badge-runs badge-both" title="Runs on the client and the server">
        <span className="runs-client">Client</span>
        <span className="visually-hidden"> and </span>
        <span className="runs-server">Server</span>
      </span>
    )
  return (
    <span className={`badge badge-runs runs-${value}`} title={`Runs on the ${value}`}>
      {runsOn[value].label}
    </span>
  )
}

/** Credits on a directory card: the marks of the projects a package is built on. */
function Credits({ builtOn }: { builtOn?: string[] }) {
  const credits = creditsFor(builtOn).filter((c) => c.mark && c.mark !== 'kitr')
  if (!credits.length) return null
  const by = credits.map((c) => c.name).join(' and ')
  return (
    <span className="dcard-credit" title={`Built on ${by}`}>
      <span className="visually-hidden">Built on {by}</span>
      {credits.map((c) => (
        <CreatorMark key={c.name} name={c.mark!} size={18} />
      ))}
    </span>
  )
}

/** One package in the directory: tile, name, a two-line summary, then where it runs. */
export function DirectoryCard({
  pkg,
  showCategory = false,
}: {
  pkg: PackageEntry
  showCategory?: boolean
}) {
  return (
    <Link to="/packages/$name" params={{ name: pkg.name }} className="dcard">
      <Tile pkg={pkg} size={40} />
      <span className="dcard-body">
        <span className="dcard-top">
          <span className="mono dcard-name">{pkg.name}</span>
          <Credits builtOn={pkg.builtOn} />
        </span>
        <span className="dcard-summary">{pkg.summary}</span>
        <span className="badges">
          {showCategory && <CategoryBadge category={pkg.category} />}
          <RunsOnBadge value={pkg.runsOn} />
        </span>
      </span>
    </Link>
  )
}

/** Not built yet: no link, a status badge, and what it will replace. */
export function PlannedCard({ pkg }: { pkg: PlannedEntry }) {
  return (
    <article className="dcard dcard-planned" id={pkg.name}>
      <Tile pkg={pkg} size={40} />
      <span className="dcard-body">
        <span className="dcard-top">
          <span className="mono dcard-name">{pkg.name}</span>
          <span className={`badge badge-status status-${pkg.status}`}>
            {plannedStatus[pkg.status].label}
          </span>
        </span>
        <span className="dcard-summary">{pkg.summary}</span>
        {pkg.replaces?.length ? (
          <span className="muted dcard-note">
            Replaces{' '}
            {pkg.replaces.map((r, i) => (
              <span key={r}>
                {i > 0 && (i === pkg.replaces!.length - 1 ? ' and ' : ', ')}
                <code>{r}</code>
              </span>
            ))}
          </span>
        ) : null}
        <span className="badges">
          <CategoryBadge category={pkg.category} />
          <RunsOnBadge value={pkg.runsOn} />
        </span>
      </span>
    </article>
  )
}
