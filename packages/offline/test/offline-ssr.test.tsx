import { createApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import offlineProvider from '../src/provider'
import { useOffline } from '../src/react'

// Regression: the provider binds `offline` in the browser only, so useOffline() threw while
// server rendering any page that showed a connection badge.
describe('useOffline during server rendering', () => {
  it('renders online with nothing pending instead of throwing', async () => {
    const app = createApp({ environment: 'server', providers: [offlineProvider] })
    await app.boot()
    function Badge() {
      const { online, pending, restored } = useOffline()
      return <p>{`${online}:${pending}:${restored}`}</p>
    }
    const html = renderToString(
      <KitrProvider app={app}>
        <Badge />
      </KitrProvider>,
    )
    expect(html).toContain('true:0:false')
  })
})
