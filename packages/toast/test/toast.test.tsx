import { createApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setToastImplementation, toast, toastError } from '../src'
import toastProvider from '../src/provider'

afterEach(() => {
  setToastImplementation(null)
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('data-theme')
})

describe('toast', () => {
  it('falls back to the console without an implementation', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    toast('hi')
    toast.success('yay')
    toast.info('fyi')
    toast.warning('hmm')
    toast.error('oh no')
    expect(info.mock.calls.map((c) => c[0])).toEqual([
      '[toast] hi',
      '[toast:success] yay',
      '[toast:info] fyi',
    ])
    expect(warn).toHaveBeenCalledWith('[toast:warning] hmm')
    expect(error).toHaveBeenCalledWith('[toast:error] oh no')
  })

  it('delegates to the installed implementation', async () => {
    const impl: any = Object.assign(vi.fn(), {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      promise: vi.fn((p: Promise<unknown>) => p),
    })
    setToastImplementation(impl)
    toast('a', { id: 1 })
    toast.success('b')
    await toast.promise(Promise.resolve(1), { loading: 'l', success: 's', error: 'e' })
    expect(impl).toHaveBeenCalledWith('a', { id: 1 })
    expect(impl.success).toHaveBeenCalledWith('b', undefined)
    expect(impl.promise).toHaveBeenCalled()
  })

  it('toastError shows the message or a fallback', () => {
    const impl: any = Object.assign(vi.fn(), { error: vi.fn() })
    setToastImplementation(impl)
    toastError(new Error('Nope'))
    toastError('weird', 'Fallback')
    expect(impl.error.mock.calls).toEqual([
      ['Nope', undefined],
      ['Fallback', undefined],
    ])
  })
})

describe('toastProvider', () => {
  it('sends toasts to sonner and mounts its toaster on the body, following data-theme', async () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    // A nonce-based CSP refuses sonner's <style> tag unless it carries the page's nonce.
    const meta = document.createElement('meta')
    meta.setAttribute('property', 'csp-nonce')
    meta.content = 'n0nce'
    document.head.append(meta)
    const app = createApp({
      providers: [toastProvider],
      config: { toast: { position: 'top-center' } },
    })
    await app.boot()
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    render(
      <KitrProvider app={app}>
        <p>page</p>
      </KitrProvider>,
    )
    await act(async () => {
      toast.success('Invoice INV-1042 saved')
    })
    expect(info).not.toHaveBeenCalled()
    expect(await screen.findByText('Invoice INV-1042 saved')).toBeTruthy()
    const styles = [...document.head.querySelectorAll('style')]
    expect(styles.some((style) => style.nonce === 'n0nce' && style.textContent?.includes('sonner'))).toBe(true)
    const toaster = document.body.querySelector('[data-sonner-toaster]')
    expect(toaster?.getAttribute('data-y-position')).toBe('top')
    expect(toaster?.getAttribute('data-sonner-theme')).toBe('dark')
    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'light')
    })
    await waitFor(() =>
      expect(
        document.body.querySelector('[data-sonner-toaster]')?.getAttribute('data-sonner-theme'),
      ).toBe('light'),
    )
  })
})
