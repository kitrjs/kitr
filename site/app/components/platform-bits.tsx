import { Add01Icon } from '@hugeicons/core-free-icons'
import { Link } from '@tanstack/react-router'
import { Fragment, useState } from 'react'
import { glyph } from '#app/lib/catalog'
import { useSwapped } from '#app/lib/motion'
import { builder, type PlatformEntry, platformMarks, platforms } from '#app/lib/platforms'
import { usePm, withManager } from '#app/lib/pm'
import { CreatorMark } from './creator-marks'
import { Icon } from './icons'

/** Text with `code` spans, as the platform prose is written. */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('`').map((part, i) =>
        // biome-ignore lint/suspicious/noArrayIndexKey: the split is stable
        i % 2 ? <code key={i}>{part}</code> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  )
}

/** One platform as a coloured tile: icon, name, the shell it ships in and where it runs. */
export function PlatformTile({
  platform,
  size = 'lg',
}: {
  platform: PlatformEntry
  size?: 'lg' | 'sm'
}) {
  const marks = platformMarks[platform.type] ?? []
  return (
    <Link
      to="/platforms/$type"
      params={{ type: platform.type }}
      className={`platform-tile platform-tile-${size}`}
      style={{ background: platform.color }}
    >
      <span className="platform-tile-top">
        <span className="platform-tile-icon">
          <Icon icon={glyph(platform.type)} size={size === 'lg' ? 30 : 22} stroke="#0B121C" />
        </span>
        <span className="platform-tile-marks" aria-hidden="true">
          {marks.map((m) => (
            <CreatorMark key={m} name={m} size={size === 'lg' ? 18 : 15} />
          ))}
        </span>
      </span>
      <span className="platform-tile-text">
        <span className="platform-tile-name">{platform.name}</span>
        <span className="platform-tile-shell mono">{platform.label}</span>
      </span>
    </Link>
  )
}

/**
 * The platform board: one tile per kind of platform, then the one you write yourself. Tauri is
 * left off because it is a second answer for desktop; the builder and /platforms still offer it.
 */
const boardPlatforms = platforms.filter((p) => p.type !== 'tauri')

export function PlatformBoard() {
  return (
    <nav className="platform-board" aria-label="Platforms">
      {boardPlatforms.map((p) => (
        <PlatformTile key={p.type} platform={p} />
      ))}
      <Link
        to="/docs/$slug"
        params={{ slug: 'platforms' }}
        hash="writing-a-platform-package"
        className="platform-tile platform-tile-lg platform-tile-own"
      >
        <span className="platform-tile-top">
          <span className="platform-tile-icon">
            <Icon icon={Add01Icon} size={30} />
          </span>
        </span>
        <span className="platform-tile-text">
          <span className="platform-tile-name">Your own</span>
          <span className="platform-tile-shell mono">definePlatform()</span>
        </span>
      </Link>
    </nav>
  )
}

/**
 * Mix and match: toggle named platforms and watch kitrrc.ts and the commands follow. Electron
 * and Tauri share the `shell` group, because a project keeps one desktop shell.
 */
export function PlatformBuilder({ headingLevel = 'h2' }: { headingLevel?: 'h1' | 'h2' }) {
  const [on, setOn] = useState(() => new Set(builder.choices.filter((c) => c.on).map((c) => c.id)))
  const pm = usePm((s) => s.pm)
  const chosen = builder.choices.filter((c) => on.has(c.id))
  const types = new Set(chosen.map((c) => c.type))
  const picked = [...on].sort().join()
  const pickedSwapped = useSwapped(picked)
  const code = `${builder.pre}<code>${builder.lines
    .filter((l) => (l.id ? on.has(l.id) : l.type ? types.has(l.type) : true))
    .map((l) => l.html)
    .join('\n')}</code></pre>`

  const toggle = (id: string) => {
    const choice = builder.choices.find((c) => c.id === id)!
    setOn((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else {
        next.add(id)
        if (choice.group)
          for (const other of builder.choices)
            if (other.group === choice.group && other.id !== id) next.delete(other.id)
      }
      return next
    })
  }

  const Heading = headingLevel
  return (
    <section className="builder" aria-labelledby="builder-title" id="mix">
      <div className="builder-copy">
        <Heading id="builder-title" className="builder-title">
          One app. As many platforms as you need.
        </Heading>
        <p className="muted">
          Each platform is one line in your config. Toggle one to see the file and the commands
          change.
        </p>
        <fieldset className="builder-choices">
          <legend className="visually-hidden">Platforms in this project</legend>
          {builder.choices.map((c) => {
            const platform = platforms.find((p) => p.type === c.type)!
            const pressed = on.has(c.id)
            return (
              <button
                key={c.id}
                type="button"
                className="builder-chip"
                aria-pressed={pressed}
                onClick={() => toggle(c.id)}
              >
                <span className="builder-chip-dot" style={{ background: platform.color }}>
                  <Icon icon={glyph(c.type)} size={14} stroke="#0B121C" strokeWidth={1.8} />
                </span>
                <span className="mono">
                  {c.line.split(':')[0]}
                  <span className="builder-chip-type">: {c.type}</span>
                </span>
              </button>
            )
          })}
        </fieldset>
      </div>
      <div className="builder-out">
        <div
          key={picked}
          className={`feature-code builder-code${pickedSwapped ? ' swap-in' : ''}`}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: lines highlighted at build time
          dangerouslySetInnerHTML={{ __html: code }}
        />
        <div className="builder-term mono" aria-live="polite">
          {chosen.length ? (
            <>
              {chosen.map((c) => (
                <div key={c.id}>
                  <span className="t-dim">$</span> {withManager(c.cmd, pm)}
                </div>
              ))}
              <div className="builder-term-gap">
                <span className="t-dim">$</span> {withManager('kitr dev', pm)}
              </div>
              {chosen.map((c) => (
                <div key={c.id} className="t-ok">
                  {'  '}✓ {(c.line.split(':')[0] ?? '').padEnd(6)}{' '}
                  <span className="t-info">{c.dev}</span>
                </div>
              ))}
            </>
          ) : (
            <div className="t-dim">
              Pick a platform. A project with none is a plain TypeScript package.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
