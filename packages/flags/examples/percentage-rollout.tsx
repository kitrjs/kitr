import flagsProvider from '@kitr/flags/provider'
import { useFlag, useFlags } from '@kitr/flags/react'
import { createApp, KitrBoot, useService } from '@kitr/react'
import { useState } from 'react'
import type { flags } from './percentage-rollout/app/flags'
import flagsConfig from './percentage-rollout/config/flags'

export const meta = {
  title: 'A redesign for 30% of users',
  description:
    'Sign in as different users. Each user always gets the same answer for the 30% rollout.',
  storage: false,
}

const app = createApp({
  environment: 'client',
  providers: [flagsProvider],
  config: { flags: flagsConfig },
})

const people = ['u_ada', 'u_grace', 'u_linus', 'u_margaret', 'u_edsger', 'u_barbara']

// Tailwind utilities on the kitr tokens, so the example looks the same in any kitr app.
const button =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-border bg-background text-foreground'
const primary =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-primary bg-primary text-primary-foreground'

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
    <div className="flex flex-col gap-3 text-[15px]">
      <div className="flex flex-wrap gap-2">
        {people.map((id) => (
          <button
            key={id}
            type="button"
            className={user === id ? primary : button}
            onClick={() => signIn(id)}
          >
            {id.slice(2)}
          </button>
        ))}
        <button type="button" className={button} onClick={() => signIn(null)} disabled={!user}>
          Sign out
        </button>
      </div>
      <p className="m-0 text-muted-foreground">
        {user ? `Signed in as ${user}` : 'Signed out'}:{' '}
        {redesigned ? 'the new dashboard' : 'the classic dashboard'}
      </p>
      <pre className="m-0 overflow-auto rounded-[10px] bg-muted px-3 py-2.5 font-mono text-[13px]">
        {JSON.stringify(all, null, 2)}
      </pre>
    </div>
  )
}

export default function PercentageRollout() {
  return (
    <KitrBoot app={app} fallback={<p className="m-0 text-muted-foreground">Resolving flags…</p>}>
      <Dashboard />
    </KitrBoot>
  )
}
