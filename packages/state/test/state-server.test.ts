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

  it('renders the initial state without a provider, in a fresh store per render', () => {
    const [useDraft] = createKitrStore({ name: 'draft', persist: false }, (set) => ({
      lines: 0,
      add: () => set((s) => ({ lines: s.lines + 1 })),
    }))
    function View() {
      const draft = useDraft()
      // A write during one render must not reach the next request.
      draft.add()
      return createElement('p', null, draft.lines)
    }
    expect(renderToString(createElement(View))).toBe('<p>0</p>')
    expect(renderToString(createElement(View))).toBe('<p>0</p>')
  })

  it('throws a clear error without a provider when strict', () => {
    const [useStrict] = createKitrStore({ name: 'strict', strict: true }, () => ({ count: 0 }))
    function View() {
      useStrict()
      return null
    }
    expect(() => renderToString(createElement(View))).toThrow(
      /Wrap the tree in its <StoreProvider>/,
    )
  })
})
