import type { DevtoolsPanel, KitrApp } from '@kitr/core'
import { Badge, Empty, KeyValue, Section, Stat, Stats } from '@kitr/devtools/ui'
import { useEffect, useState } from 'react'

/** The Platform panel: active platform, OS and which package supplies each capability driver. */
export function panels(app: KitrApp): DevtoolsPanel[] {
  return [
    {
      id: 'platform',
      label: 'Platform',
      group: 'platform',
      render: () => <PlatformPanel app={app} />,
    },
  ]
}

function PlatformPanel({ app }: { app: KitrApp }) {
  const platform = app.container.use('platform')
  const [online, setOnline] = useState(() => platform.isOnline())
  const [safeArea, setSafeArea] = useState(() => platform.safeArea())
  useEffect(() => {
    // The browser events are the cheapest live source; they also cover drivers without onOnline.
    const refreshOnline = () => setOnline(platform.isOnline())
    const refreshArea = () => setSafeArea(platform.safeArea())
    window.addEventListener('online', refreshOnline)
    window.addEventListener('offline', refreshOnline)
    window.addEventListener('resize', refreshArea)
    window.addEventListener('orientationchange', refreshArea)
    return () => {
      window.removeEventListener('online', refreshOnline)
      window.removeEventListener('offline', refreshOnline)
      window.removeEventListener('resize', refreshArea)
      window.removeEventListener('orientationchange', refreshArea)
    }
  }, [platform])
  const drivers = app.drivers.capabilities().map((c) => {
    const d = app.drivers.describe(c)
    return [c, d ? `${d.platform ?? 'default'} (priority ${d.priority})` : '—'] as [string, string]
  })
  return (
    <div className="kitr-dt-stack">
      <Stats>
        <Stat label="Platform" value={platform.name ?? 'unknown'} />
        <Stat label="Type" value={platform.type} />
        <Stat label="OS" value={String(platform.os)} />
        <Stat
          label="Online"
          value={<Badge tone={online ? 'ok' : 'warn'}>{online ? 'online' : 'offline'}</Badge>}
        />
        <Stat label="Native" value={String(platform.native)} />
        <Stat label="Standalone" value={String(platform.standalone)} />
      </Stats>
      <Section title="Safe area">
        <KeyValue rows={Object.entries(safeArea)} />
      </Section>
      <Section title="Drivers" count={drivers.length}>
        {drivers.length ? <KeyValue rows={drivers} /> : <Empty>Browser defaults</Empty>}
      </Section>
    </div>
  )
}
