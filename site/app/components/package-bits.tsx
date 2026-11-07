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

/** Client in blue, server in amber; packages that run in both get one badge split diagonally. */
export function RunsOnBadge({ value }: { value: RunsOn }) {
  const r = runsOn[value]
  return (
    <span
      className="badge"
      style={{ background: r.background }}
      title={`Runs on: ${r.label.replace(' ', ' and ')}`}
    >
      <Icon icon={r.icon} size={13} stroke="#0B121C" strokeWidth={2} />
      {r.label}
    </span>
  )
}

export function PackageCard({ pkg }: { pkg: PackageEntry }) {
  return (
    <Link to="/packages/$name" params={{ name: pkg.name }} className="card">
      <span className="card-head">
        <Tile pkg={pkg} />
        <span className="mono card-name">{pkg.name}</span>
      </span>
      <span className="card-summary">{pkg.summary}</span>
      <span className="badges">
        <CategoryBadge category={pkg.category} />
        <RunsOnBadge value={pkg.runsOn} />
      </span>
    </Link>
  )
}

/** Not built yet: no link, a status badge, and what it will replace. */
export function PlannedCard({ pkg }: { pkg: PlannedEntry }) {
  return (
    <article className="card card-planned" id={pkg.name}>
      <span className="card-head">
        <Tile pkg={pkg} />
        <span className="mono card-name">{pkg.name}</span>
        <span className={`badge badge-status status-${pkg.status}`}>
          {plannedStatus[pkg.status].label}
        </span>
      </span>
      <span className="card-summary">{pkg.summary}</span>
      {pkg.replaces?.length ? (
        <span className="muted card-note">
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
    </article>
  )
}
