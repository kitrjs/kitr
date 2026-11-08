import { createApp } from '@kitr/core'
import { createDevtoolsHub } from '@kitr/devtools'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { queryProvider } from '../src'
import { panels } from '../src/devtools'

afterEach(cleanup)

async function setup() {
  const app = createApp({ providers: [queryProvider] })
  app.container.value('devtools', createDevtoolsHub())
  await app.boot()
  return app
}

describe('query devtools panel', () => {
  it('lists queries, shows the error badge and invalidates', async () => {
    const app = await setup()
    const client = app.container.use('queryClient')
    client.setQueryData(['todos'], [{ id: 1 }])
    const panel = panels()[0]
    expect(panel?.group).toBe('data')
    expect(panel?.badge?.(app)).toBeNull()

    render(<div>{panel?.render(app)}</div>)
    expect(screen.getByText('["todos"]')).toBeTruthy()
    expect(screen.getByText('inactive', { selector: 'span' })).toBeTruthy()

    const query = client.getQueryCache().find({ queryKey: ['todos'] })
    expect(query?.state.isInvalidated).toBe(false)
    await act(async () => {
      await panel?.actions?.find((a) => a.id === 'invalidate-all')?.run(app)
    })
    expect(query?.state.isInvalidated).toBe(true)

    act(() => query?.setState({ status: 'error', error: new Error('x'), fetchStatus: 'idle' }))
    expect(panel?.badge?.(app)).toEqual({ value: 1, tone: 'error' })
  })

  it('shows an empty state', async () => {
    const app = await setup()
    render(<div>{panels()[0]?.render(app)}</div>)
    expect(screen.getByText('No queries')).toBeTruthy()
  })
})
