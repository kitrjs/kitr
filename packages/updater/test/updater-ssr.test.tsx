import { createApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import updaterProvider from '../src/provider'
import { useUpdate } from '../src/react'

// The provider binds `updater` in the browser only; useUpdate() must still render on the server.
describe('useUpdate during server rendering', () => {
  it('renders idle instead of throwing', async () => {
    const app = createApp({ environment: 'server', providers: [updaterProvider] })
    await app.boot()
    function Banner() {
      const update = useUpdate()
      return <p>{`${update.status}:${update.available}`}</p>
    }
    const html = renderToString(
      <KitrProvider app={app}>
        <Banner />
      </KitrProvider>,
    )
    expect(html).toContain('idle:false')
  })
})
