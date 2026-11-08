import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createKitrStore } from '../src'

describe('createKitrStore (server)', () => {
  const [useCounter, Provider, store] = createKitrStore({ name: 'ssr' }, () => ({ count: 0 }))

  it('has no singleton on the server', () => {
    expect(store).toBeNull()
  })

  it('gives every request its own store through the provider', () => {
    function View() {
      return createElement(
        'p',
        null,
        useCounter((s) => s.count),
      )
    }
    const a = renderToString(
      createElement(Provider, { initialState: { count: 1 }, children: createElement(View) }),
    )
    const b = renderToString(createElement(Provider, { children: createElement(View) }))
    expect(a).toContain('>1<')
    expect(b).toContain('>0<')
  })

  it('throws a clear error without a provider', () => {
    function View() {
      useCounter()
      return null
    }
    expect(() => renderToString(createElement(View))).toThrow(
      /Wrap the tree in its <StoreProvider>/,
    )
  })
})
