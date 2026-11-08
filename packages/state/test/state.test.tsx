import { act, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { createKitrStore } from '../src'

type Counter = { count: number; inc: () => void }

describe('createKitrStore (client)', () => {
  it('is a module singleton usable inside and outside React', () => {
    const [useCounter, , store] = createKitrStore<Counter>({ name: 'counter-a' }, (set) => ({
      count: 0,
      inc: () => set((s) => ({ count: s.count + 1 })),
    }))
    const { result } = renderHook(() => useCounter((s) => s.count))
    expect(result.current).toBe(0)
    act(() => store!.getState().inc())
    expect(result.current).toBe(1)
    const whole = renderHook(() => useCounter())
    expect(whole.result.current.count).toBe(1)
  })

  it('StoreProvider seeds initial state', () => {
    const [useCounter, Provider] = createKitrStore<Counter>({ name: 'counter-b' }, (set) => ({
      count: 0,
      inc: () => set((s) => ({ count: s.count + 1 })),
    }))
    function View() {
      return <p>{useCounter((s) => s.count)}</p>
    }
    render(
      <Provider initialState={{ count: 5 }}>
        <View />
      </Provider>,
    )
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('persists under a kitr: key when asked', () => {
    const [, , store] = createKitrStore<{ theme: string; set: (t: string) => void }>(
      { name: 'prefs', persist: true, devtools: false },
      (set) => ({ theme: 'light', set: (theme) => set({ theme }) }),
    )
    act(() => store!.getState().set('dark'))
    expect(JSON.parse(localStorage.getItem('kitr:prefs')!).state.theme).toBe('dark')
  })

  it('wrapper helper type-checks', () => {
    const [useS, Provider] = createKitrStore({ name: 'w' }, () => ({ v: 1 }))
    const wrapper = ({ children }: { children: ReactNode }) => <Provider>{children}</Provider>
    expect(renderHook(() => useS((s) => s.v), { wrapper }).result.current).toBe(1)
  })
})
