import type { DevtoolsPanel, KitrApp } from '@kitr/core'
import { icons, panelIcons } from '../icon'
import { Badge, KeyValue, Masked, Row, Section, Stat, Stats } from '../ui'

const lifecycle = ['register', 'boot', 'wrap', 'ready', 'shutdown', 'devtools'] as const
const secret = /KEY|SECRET|TOKEN|PASSWORD/i

/** The app itself: runtime facts, providers, container bindings, config and public env. */
export function appPanel(): DevtoolsPanel {
  return {
    id: 'app',
    label: 'App',
    group: 'app',
    icon: panelIcons.app,
    render: (app) => <AppPanel app={app} />,
    actions: [
      { id: 'reload', label: 'Reload', icon: icons.refresh, run: () => window.location.reload() },
      {
        id: 'copy-state',
        label: 'Copy state',
        hint: 'mode, providers, config as JSON',
        icon: icons.copy,
        run: async (app) => {
          await navigator.clipboard.writeText(
            JSON.stringify(
              {
                mode: app.mode,
                environment: app.environment,
                status: app.status,
                platform: app.platform ?? 'web',
                providers: app.providers.map((p) => p.name),
                config: Object.fromEntries(app.config.entries()),
              },
              null,
              2,
            ),
          )
          return 'copied'
        },
      },
    ],
  }
}

function packageCount(app: KitrApp): number {
  const packages = (import.meta as unknown as { env?: Record<string, unknown> }).env?.KITR_PACKAGES
  return Array.isArray(packages) ? packages.length : app.providers.length
}

function configOf(app: KitrApp, name: string): unknown {
  const config = app.config as unknown as { has(k: string): boolean; get(k: string): unknown }
  return config.has(name) ? config.get(name) : undefined
}

function AppPanel({ app }: { app: KitrApp }) {
  const publicEnv = Object.entries(app.env).filter(
    ([k]) => k.startsWith('VITE_') || k.startsWith('PUBLIC_'),
  )
  return (
    <div className="kitr-dt-stack">
      <Stats>
        <Stat label="mode" value={app.mode} />
        <Stat label="environment" value={app.environment} />
        <Stat label="status" value={app.status} tone={app.status === 'ready' ? 'ok' : 'muted'} />
        <Stat label="platform" value={app.platform ?? 'web'} />
        <Stat label="providers" value={app.providers.length} />
        <Stat label="packages" value={packageCount(app)} />
      </Stats>
      <Section title="Providers" count={app.providers.length}>
        {app.providers.map((p) => {
          const config = configOf(app, p.name)
          return (
            <Row
              key={p.name}
              head={
                <>
                  <span className="kitr-dt-key">{p.name}</span>
                  {lifecycle
                    .filter((k) => typeof p[k] === 'function')
                    .map((k) => (
                      <Badge key={k}>{k}</Badge>
                    ))}
                </>
              }
            >
              {config !== undefined ? <KeyValue rows={[[p.name, config]]} /> : null}
            </Row>
          )
        })}
      </Section>
      <Section title="Container">
        <KeyValue rows={app.container.keys().map((k) => [k, describe(safeUse(app, k))])} />
      </Section>
      <Section title="Config" open={false}>
        <KeyValue rows={app.config.entries()} />
      </Section>
      <Section title="Env" open={false}>
        <table className="kitr-dt-table">
          <tbody>
            {publicEnv.map(([k, v]) => (
              <tr key={k}>
                <td className="kitr-dt-key">{k}</td>
                <td>{secret.test(k) ? <Masked value={String(v)} /> : String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  )
}

function safeUse(app: KitrApp, key: string): unknown {
  try {
    return app.container.use(key)
  } catch {
    return '(not resolved)'
  }
}

function describe(value: unknown): string {
  if (value === null || value === undefined) return String(value)
  if (typeof value === 'function') return `ƒ ${value.name || 'anonymous'}`
  if (typeof value !== 'object') return String(value)
  const ctor = (value as object).constructor?.name
  return ctor && ctor !== 'Object'
    ? ctor
    : `{ ${Object.keys(value as object)
        .slice(0, 6)
        .join(', ')} }`
}
