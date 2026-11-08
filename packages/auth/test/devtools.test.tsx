import { createApp } from '@kitr/core'
import { createDevtoolsHub } from '@kitr/devtools'
import * as ui from '@kitr/devtools/ui'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { customAdapter } from '../src'
import { panels } from '../src/devtools'
import authProvider from '../src/provider'
import { createSession } from '../src/session'

afterEach(cleanup)

async function setup(user: { id: string } | null) {
  let current = user
  const adapter = customAdapter<{ id: string }, never>({
    getSession: async () => (current ? createSession(current) : null),
    signOut: async () => {
      current = null
    },
  })
  const app = createApp({ providers: [authProvider], config: { auth: { adapter } } })
  app.container.value('devtools', createDevtoolsHub())
  await app.boot()
  return app
}

describe('auth devtools panel', () => {
  it('badges in and out', async () => {
    const panel = panels(ui)[0]
    expect(panel?.group).toBe('app')
    expect(panel?.badge?.(await setup({ id: 'u1' }))).toEqual({ value: 'in', tone: 'ok' })
    expect(panel?.badge?.(await setup(null))).toEqual({ value: 'out', tone: 'muted' })
  })

  it('shows the user and signs out', async () => {
    const app = await setup({ id: 'u1' })
    const panel = panels(ui)[0]
    render(<div>{panel?.render(app)}</div>)
    expect(screen.getByText('authenticated')).toBeTruthy()
    expect(screen.getByText('"u1"')).toBeTruthy()
    await act(async () => {
      await panel?.actions?.find((a) => a.id === 'sign-out')?.run(app)
    })
    expect(app.container.use('auth').user).toBeNull()
    expect(panel?.badge?.(app)).toEqual({ value: 'out', tone: 'muted' })
  })
})
