import type { DevtoolsPanel, KitrApp } from '@kitr/core'
import type { Auth } from './provider'

export function panels(): DevtoolsPanel[] {
  return [
    {
      id: 'auth',
      label: 'Auth',
      badge: (app) => (app.container.use('auth').user ? 'in' : 'out'),
      render: (app) => <AuthPanel app={app} />,
      actions: [
        {
          id: 'reload',
          label: 'Reload session',
          run: (app) => void app.container.use('auth').load(),
        },
        {
          id: 'refresh',
          label: 'Refresh token',
          run: (app) => void app.container.use('auth').refresh(),
        },
        { id: 'sign-out', label: 'Sign out', run: (app) => app.container.use('auth').signOut() },
      ],
    },
  ]
}

function AuthPanel({ app }: { app: KitrApp }) {
  const auth = app.container.use('auth') as Auth
  const session = auth.session
  return (
    <div className="kitr-dt-stack">
      <section>
        <h4 className="kitr-dt-h">Session</h4>
        <table className="kitr-dt-table">
          <tbody>
            <tr>
              <td className="kitr-dt-key">status</td>
              <td>
                <span className={`kitr-dt-badge kitr-dt-badge-${session.user ? 'ok' : 'warn'}`}>
                  {session.user ? 'authenticated' : 'anonymous'}
                </span>
              </td>
            </tr>
            <tr>
              <td className="kitr-dt-key">user</td>
              <td>
                <pre className="kitr-dt-pre">{JSON.stringify(session.user, null, 1)}</pre>
              </td>
            </tr>
            <tr>
              <td className="kitr-dt-key">expiresAt</td>
              <td>{session.expiresAt ? new Date(session.expiresAt).toISOString() : 'n/a'}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}
