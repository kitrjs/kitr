import type { DevtoolsPanel, KitrApp } from '@kitr/core'

/** The Platform panel: active platform, OS and which package supplies each capability driver. */
export function panels(app: KitrApp): DevtoolsPanel[] {
  return [
    {
      id: 'platform',
      label: 'Platform',
      render: () => <PlatformPanel app={app} />,
    },
  ]
}

function PlatformPanel({ app }: { app: KitrApp }) {
  const platform = app.container.use('platform')
  const rows: Array<[string, string]> = [
    ['name', platform.name ?? '(unknown)'],
    ['type', platform.type],
    ['os', String(platform.os)],
    ['native', String(platform.native)],
    ['standalone', String(platform.standalone)],
    ['online', String(platform.isOnline())],
  ]
  const drivers = app.drivers.capabilities().map((c) => {
    const d = app.drivers.describe(c)
    return [c, d ? `${d.platform ?? 'default'} (priority ${d.priority})` : '—'] as [string, string]
  })
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12, padding: 8 }}>
      <table>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td style={{ paddingRight: 12, opacity: 0.7 }}>{k}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 style={{ margin: '12px 0 4px' }}>Drivers</h4>
      {drivers.length === 0 ? (
        <div style={{ opacity: 0.7 }}>No platform drivers registered (browser defaults).</div>
      ) : (
        <table>
          <tbody>
            {drivers.map(([k, v]) => (
              <tr key={k}>
                <td style={{ paddingRight: 12, opacity: 0.7 }}>{k}</td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
