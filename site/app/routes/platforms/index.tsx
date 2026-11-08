import { createFileRoute, Link } from '@tanstack/react-router'
import { Icon } from '#app/components/icons'
import { PlatformBoard, PlatformBuilder, Rich } from '#app/components/platform-bits'
import { glyph } from '#app/lib/catalog'
import { platforms } from '#app/lib/platforms'
import { seo } from '#app/lib/seo'

export const Route = createFileRoute('/platforms/')({
  head: () =>
    seo({
      title: 'Platforms · kitr',
      description:
        'Ship one TypeScript app to the browser, a server, Windows, macOS, Linux, iPhone and Android, and mix them in one project.',
      path: '/platforms',
    }),
  component: Platforms,
})

function Platforms() {
  return (
    <main className="container platforms-page">
      <section className="platforms-intro">
        <div className="platforms-intro-copy">
          <span className="label">Platforms</span>
          <h1 className="display platform-title">Pick the platform, not the framework.</h1>
          <p className="lede">
            Where your app runs is a platform. Add one with a single command. They all share your
            code, your packages and the CLI.
          </p>
        </div>
        <PlatformBoard />
      </section>

      <section className="platform-table" aria-labelledby="compare-platforms">
        <h2 id="compare-platforms" className="visually-hidden">
          Every platform at a glance
        </h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Platform</th>
                <th>Targets</th>
                <th>Built with</th>
                <th>Add it</th>
              </tr>
            </thead>
            <tbody>
              {platforms.map((p) => (
                <tr key={p.type}>
                  <th scope="row">
                    <Link
                      to="/platforms/$type"
                      params={{ type: p.type }}
                      className="platform-row-name"
                    >
                      <span className="tile" style={{ width: 32, height: 32, background: p.color }}>
                        <Icon icon={glyph(p.type)} size={18} stroke="#0B121C" />
                      </span>
                      {p.name}
                    </Link>
                  </th>
                  <td className="platform-table-targets">{p.targets.join(', ')}</td>
                  <td className="platform-table-shell">{p.shell}</td>
                  <td>
                    <code>{p.command}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted platform-table-note">
          <Rich text="Need something else, like a kiosk or a browser extension? A platform is a package with a `definePlatform()` factory, so you can write your own." />{' '}
          <Link to="/docs/$slug" params={{ slug: 'platforms' }} hash="writing-a-platform-package">
            Write a platform →
          </Link>
        </p>
      </section>

      <PlatformBuilder />
    </main>
  )
}
