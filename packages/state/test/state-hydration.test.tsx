import { act } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { createKitrStore } from '../src'

// Regression: the server rendered a persisted store's initial state, the browser's first render
// read the saved state, and React reported a hydration mismatch for returning visitors.
describe('persisted store hydration', () => {
  it('hydrates with the server state, then shows the saved state', async () => {
    localStorage.setItem(
      'kitr:hydrate-prefs',
      JSON.stringify({ state: { theme: 'dark' }, version: 0 }),
    )
    const [usePrefs] = createKitrStore<{ theme: string }>(
      { name: 'hydrate-prefs', persist: true, devtools: false },
      () => ({ theme: 'light' }),
    )
    function Theme() {
      return <p>{usePrefs((s) => s.theme)}</p>
    }
    const container = document.createElement('div')
    container.innerHTML = '<p>light</p>' // what the server rendered
    document.body.append(container)
    const errors: unknown[] = []
    await act(async () => {
      hydrateRoot(container, <Theme />, { onRecoverableError: (e) => errors.push(e) })
    })
    expect(errors).toEqual([])
    expect(container.textContent).toBe('dark')
  })
})
