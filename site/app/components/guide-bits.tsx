import { Link } from '@tanstack/react-router'
import { findPackage } from '#app/lib/catalog'
import type { GuideItem } from '#app/lib/content'
import { Tile } from './package-bits'

/** A guide on the index: title, one sentence, the packages it uses and how long it takes. */
export function GuideCard({ guide }: { guide: GuideItem }) {
  const used = guide.packages.map(findPackage).filter((p) => p !== undefined)
  return (
    <Link to="/guides/$slug" params={{ slug: guide.slug }} className="guide-card">
      <span className="guide-card-title">
        {guide.title}
        {guide.preview && <PreviewBadge />}
      </span>
      <span className="guide-card-summary">{guide.description}</span>
      <span className="guide-card-foot">
        <span className="guide-tiles">
          <span className="sr-only">Uses {used.map((p) => p.name).join(', ')}</span>
          {used.slice(0, 6).map((p) => (
            <Tile key={p.name} pkg={p} size={26} />
          ))}
          {used.length > 6 && <span className="mono muted guide-more">+{used.length - 6}</span>}
        </span>
        {guide.time && <span className="mono muted guide-time">{guide.time}</span>}
      </span>
    </Link>
  )
}

/** On a guide built on packages that are not published yet. */
function PreviewBadge() {
  return (
    <span
      className="badge badge-status guide-preview"
      title="Built on packages that are not published yet"
    >
      Preview
    </span>
  )
}

/** Under a guide's title: how long it takes and the packages it uses, each linked. */
export function GuideMeta({
  packages,
  time,
  preview,
}: {
  packages: string[]
  time?: string
  preview?: boolean
}) {
  const used = packages.map(findPackage).filter((p) => p !== undefined)
  if (!used.length && !time && !preview) return null
  return (
    <div className="guide-meta">
      {preview && <PreviewBadge />}
      {time && <span className="mono muted">{time}</span>}
      {used.length > 0 && (
        <ul className="kit-chips" aria-label="Packages this guide uses">
          {used.map((p) => (
            <li key={p.name}>
              <Link to="/packages/$name" params={{ name: p.name }} className="kit-chip mono">
                <Tile pkg={p} size={16} />
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
