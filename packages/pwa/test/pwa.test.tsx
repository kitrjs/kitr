import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useInstallPrompt, useOnline } from '../src'

describe('useOnline', () => {
  it('follows online/offline events', () => {
    const { result } = renderHook(() => useOnline())
    expect(result.current).toBe(navigator.onLine)
    act(() => void window.dispatchEvent(new Event('offline')))
    expect(result.current).toBe(false)
    act(() => void window.dispatchEvent(new Event('online')))
    expect(result.current).toBe(true)
  })
})

describe('useInstallPrompt', () => {
  it('captures the prompt, installs on accept and clears after appinstalled', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)
    expect(await result.current.install()).toBe('unavailable')
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn(async () => {}),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    act(() => void window.dispatchEvent(event))
    expect(event.defaultPrevented).toBe(true)
    expect(result.current.canInstall).toBe(true)
    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.install()
    })
    expect(outcome).toBe('accepted')
    expect(event.prompt).toHaveBeenCalled()
    expect(result.current.canInstall).toBe(false)
    act(() => void window.dispatchEvent(new Event('appinstalled')))
    expect(result.current.installed).toBe(true)
  })
})
