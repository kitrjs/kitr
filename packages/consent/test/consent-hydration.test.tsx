import { createApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { act } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import consentProvider from '../src/provider'
import { useConsent } from '../src/react'

afterEach(() => {
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0]!.trim()
    if (name) document.cookie = `${name}=; max-age=0; path=/`
  }
})

// The server and the browser's first pass both render the undecided state, so hydration matches;
// the banner hides for a returning visitor after that.
describe('consent banner hydration', () => {
  it('hydrates as undecided, then hides the banner for a returning visitor', async () => {
    const first = createApp({ environment: 'client', providers: [consentProvider] })
    await first.boot()
    first.container.use('consent').acceptAll()

    const app = createApp({ environment: 'client', providers: [consentProvider] })
    await app.boot()
    function Banner() {
      const { decided } = useConsent()
      return decided ? null : <div>We use cookies</div>
    }
    const container = document.createElement('div')
    container.innerHTML = '<div>We use cookies</div>' // what the server rendered
    document.body.append(container)
    const errors: unknown[] = []
    await act(async () => {
      hydrateRoot(
        container,
        <KitrProvider app={app}>
          <Banner />
        </KitrProvider>,
        { onRecoverableError: (e) => errors.push(e) },
      )
    })
    expect(errors).toEqual([])
    expect(container.textContent).toBe('')
  })
})
