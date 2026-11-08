import { defineFlags, percentageFlagsProvider, staticFlagsProvider } from '@kitr/flags'
import flagsProvider from '@kitr/flags/provider'
import { useFlag, useFlags } from '@kitr/flags/react'
import { createApp, KitrBoot, useService } from '@kitr/react'
import { useState } from 'react'

export const meta = {
  title: 'A redesign for 30% of users',
  description:
    'Sign in as different users. Each user always gets the same answer for the 30% rollout.',
  storage: false,
}

const flags = defineFlags({
  'new-dashboard': { default: false, description: 'The redesigned dashboard' },
  'support-chat': { default: true, description: 'The chat widget' },
})

const app = createApp({
  environment: 'client',
  providers: [flagsProvider],
  config: {
    flags: {
      definitions: flags,
      providers: [
        staticFlagsProvider({ 'support-chat': true }),
        // The salt picks who lands in the 30%: change it and a different group of users gets the redesign.
        percentageFlagsProvider({ 'new-dashboard': 30 }, 'dashboard-2026'),
      ],
    },
  },
})

const people = ['u_ada', 'u_grace', 'u_linus', 'u_margaret', 'u_edsger', 'u_barbara']

function Dashboard() {
  const service = useService('flags')
  const redesigned = useFlag<typeof flags, 'new-dashboard'>('new-dashboard')
  const all = useFlags<typeof flags>()
  const [user, setUser] = useState<string | null>(null)
  const signIn = (userId: string | null) => {
    setUser(userId)
    void service.resolve(userId ? { userId } : {})
  }
  return (
    <div className="demo">
      <div className="demo-row">
        {people.map((id) => (
          <button
            key={id}
            type="button"
            className={`demo-button${user === id ? ' primary' : ''}`}
            onClick={() => signIn(id)}
          >
            {id.slice(2)}
          </button>
        ))}
        <button type="button" className="demo-button" onClick={() => signIn(null)} disabled={!user}>
          Sign out
        </button>
      </div>
      <p className="demo-muted">
        {user ? `Signed in as ${user}` : 'Signed out'}:{' '}
        {redesigned ? 'the new dashboard' : 'the classic dashboard'}
      </p>
      <pre className="mono demo-code">{JSON.stringify(all, null, 2)}</pre>
    </div>
  )
}

export default function PercentageRollout() {
  return (
    <KitrBoot app={app} fallback={<p className="demo-muted">Resolving flags…</p>}>
      <Dashboard />
    </KitrBoot>
  )
}
