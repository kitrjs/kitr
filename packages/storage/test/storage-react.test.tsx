import { act, render, renderHook, screen } from '@testing-library/react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { defineCookie, defineStorage, listStorage, removeStorageKey, serializeCookie } from '../src'
import { CookieHeader, useCookie, useStorage } from '../src/react'

describe('useStorage', () => {
  it('reads, writes and removes, re-rendering subscribers', () => {
    const item = defineStorage('react-a', { default: 0 })
    const { result } = renderHook(() => useStorage(item))
    expect(result.current[0]).toBe(0)
    act(() => result.current[1]((n) => n + 2))
    expect(result.current[0]).toBe(2)
    act(() => result.current[2]())
    expect(result.current[0]).toBe(0)
  })

  it('picks up writes from other tabs via the storage event', () => {
    const item = defineStorage('react-tab', { default: 'none' })
    const { result } = renderHook(() => useStorage(item))
    act(() => {
      localStorage.setItem('react-tab', JSON.stringify({ v: 1, d: 'other-tab' }))
      window.dispatchEvent(new StorageEvent('storage', { key: 'react-tab' }))
    })
    expect(result.current[0]).toBe('other-tab')
  })

  it('keeps working in memory when storage is full', () => {
    const item = defineStorage('react-quota', { default: 'a' })
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const { result } = renderHook(() => useStorage(item))
    act(() => result.current[1]('b'))
    expect(result.current[0]).toBe('b')
    spy.mockRestore()
  })

  it('server-renders the default so hydration matches', () => {
    localStorage.setItem('react-ssr', JSON.stringify({ v: 1, d: 'stored' }))
    const item = defineStorage('react-ssr', { default: 'default' })
    function View() {
      return createElement('p', null, useStorage(item)[0])
    }
    expect(renderToString(createElement(View))).toBe('<p>default</p>')
  })

  it('devtools helpers list and remove keys', () => {
    const item = defineStorage('listed', { default: 1 })
    item.set(5)
    expect(listStorage('local').map((e) => e.key)).toContain('listed')
    const listener = vi.fn()
    item.subscribe(listener)
    removeStorageKey('local', 'listed')
    expect(item.get()).toBe(1)
    expect(listener).toHaveBeenCalled()
  })
})

describe('useCookie', () => {
  it('reads and writes document.cookie and notifies', () => {
    const locale = defineCookie('react-locale', { default: 'en' })
    const { result } = renderHook(() => useCookie(locale))
    expect(result.current[0]).toBe('en')
    act(() => result.current[1]('de'))
    expect(result.current[0]).toBe('de')
    expect(document.cookie).toContain('react-locale=de')
    act(() => result.current[2]())
    expect(result.current[0]).toBe('en')
  })

  it('server-renders from <CookieHeader> so SSR shows the real value', () => {
    const prefs = defineCookie<{ compact: boolean }>('prefs', { default: { compact: false } })
    function View() {
      return createElement('p', null, useCookie(prefs)[0].compact ? 'compact' : 'roomy')
    }
    const header = serializeCookie('prefs', JSON.stringify({ compact: true })).split(';')[0]
    const html = renderToString(
      createElement(CookieHeader, { value: header, children: createElement(View) }),
    )
    expect(html).toBe('<p>compact</p>')
    expect(renderToString(createElement(View))).toBe('<p>roomy</p>')
  })

  it('renders client-side too', () => {
    const c = defineCookie('shown', { default: 'x' })
    function View() {
      return createElement('p', null, useCookie(c)[0])
    }
    render(createElement(View))
    expect(screen.getByText('x')).toBeTruthy()
  })
})
