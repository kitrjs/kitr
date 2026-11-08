import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useServiceWorker } from '../src/client'

/** A ServiceWorkerRegistration that can announce an update, the way a browser does. */
function fakeRegistration(init: { waiting?: boolean; active?: boolean } = {}) {
  const listeners: Record<string, Array<() => void>> = {}
  const worker = {
    state: 'installing',
    listeners: [] as Array<() => void>,
    addEventListener(_: string, fn: () => void) {
      worker.listeners.push(fn)
    },
  }
  const waiting = init.waiting ? { postMessage: vi.fn() } : null
  const registration = {
    waiting,
    active: init.active ? {} : null,
    installing: null as typeof worker | null,
    addEventListener(type: string, fn: () => void) {
      listeners[type] = [...(listeners[type] ?? []), fn]
    },
  }
  return {
    registration,
    waiting,
    /** A new worker was found and starts installing. */
    found() {
      registration.installing = worker
      for (const fn of listeners.updatefound ?? []) fn()
    },
    /** The worker moves to a new state. */
    moveTo(state: string) {
      worker.state = state
      for (const fn of worker.listeners) fn()
    },
  }
}

function stubServiceWorker(reg: ReturnType<typeof fakeRegistration>, controller: unknown = null) {
  const register = vi.fn(async (_path: string) => reg.registration)
  const events: string[] = []
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register,
      controller,
      addEventListener: (type: string) => events.push(type),
    },
  })
  return { register, events }
}

describe('useServiceWorker', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('does nothing in a browser without service workers', () => {
    const { result } = renderHook(() => useServiceWorker())
    expect(result.current).toMatchObject({ needRefresh: false, offlineReady: false })
    expect(result.current.registration).toBeNull()
  })

  it('registers /sw.js by default, or the path it is given', async () => {
    const a = stubServiceWorker(fakeRegistration())
    renderHook(() => useServiceWorker())
    await waitFor(() => expect(a.register).toHaveBeenCalledWith('/sw.js'))
    const b = stubServiceWorker(fakeRegistration())
    renderHook(() => useServiceWorker({ path: '/app/sw.js' }))
    await waitFor(() => expect(b.register).toHaveBeenCalledWith('/app/sw.js'))
  })

  it('reports a waiting worker as an update and calls onNeedRefresh', async () => {
    stubServiceWorker(fakeRegistration({ waiting: true }))
    const onNeedRefresh = vi.fn()
    const { result } = renderHook(() => useServiceWorker({ onNeedRefresh }))
    await waitFor(() => expect(result.current.needRefresh).toBe(true))
    expect(onNeedRefresh).toHaveBeenCalled()
    expect(result.current.registration).not.toBeNull()
  })

  it('is offline ready once an active worker has nothing pending', async () => {
    stubServiceWorker(fakeRegistration({ active: true }))
    const { result } = renderHook(() => useServiceWorker())
    await waitFor(() => expect(result.current.offlineReady).toBe(true))
    expect(result.current.needRefresh).toBe(false)
  })

  it('a first install makes the app offline ready', async () => {
    const reg = fakeRegistration()
    stubServiceWorker(reg, null)
    const { result } = renderHook(() => useServiceWorker())
    await waitFor(() => expect(result.current.registration).not.toBeNull())
    act(() => {
      reg.found()
      reg.moveTo('installed')
    })
    expect(result.current.offlineReady).toBe(true)
    expect(result.current.needRefresh).toBe(false)
  })

  it('a later install asks for a refresh, once it has finished installing', async () => {
    const reg = fakeRegistration({ active: true })
    stubServiceWorker(reg, {})
    const onNeedRefresh = vi.fn()
    const { result } = renderHook(() => useServiceWorker({ onNeedRefresh }))
    await waitFor(() => expect(result.current.registration).not.toBeNull())
    act(() => {
      reg.found()
      reg.moveTo('installing')
    })
    expect(result.current.needRefresh).toBe(false)
    act(() => reg.moveTo('installed'))
    expect(result.current.needRefresh).toBe(true)
    expect(onNeedRefresh).toHaveBeenCalledTimes(1)
  })

  it('update() tells the waiting worker to take over and reloads on the switch', async () => {
    const reg = fakeRegistration({ waiting: true })
    const sw = stubServiceWorker(reg)
    const { result } = renderHook(() => useServiceWorker())
    await waitFor(() => expect(result.current.needRefresh).toBe(true))
    result.current.update()
    expect(reg.waiting?.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(sw.events).toContain('controllerchange')
  })

  it('ignores a registration that fails', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register: vi.fn(async () => Promise.reject(new Error('blocked'))) },
    })
    const { result } = renderHook(() => useServiceWorker())
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current.registration).toBeNull()
  })

  it('does not set state after unmount', async () => {
    stubServiceWorker(fakeRegistration({ waiting: true }))
    const { result, unmount } = renderHook(() => useServiceWorker())
    unmount()
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current.needRefresh).toBe(false)
  })
})
