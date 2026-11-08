import { createApp, defineProvider } from '@kitr/core'
import { act, render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { describe, expect, it } from 'vitest'
import { KitrBoot, KitrProvider, useApp, useConfig, useService } from '../src'

describe('KitrProvider', () => {
  it('provides the app and wraps providers outermost-first', async () => {
    const app = createApp({
      config: { greeting: 'hello' },
      providers: [
        defineProvider({ name: 'outer', wrap: (c) => <section data-testid="outer">{c}</section> }),
        defineProvider({
          name: 'inner',
          register: (a) => void a.container.value('answer', 42),
          wrap: (c) => <article data-testid="inner">{c}</article>,
        }),
      ],
    })
    await app.boot()
    function View() {
      return (
        <p>
          {String(useConfig('greeting'))} {String(useService('answer'))}{' '}
          {useApp() === app ? 'same' : 'other'}
        </p>
      )
    }
    render(
      <KitrProvider app={app}>
        <View />
      </KitrProvider>,
    )
    expect(screen.getByText('hello 42 same')).toBeTruthy()
    const outer = screen.getByTestId('outer')
    expect(outer.firstElementChild?.getAttribute('data-testid')).toBe('inner')
  })

  it('suspends until an unbooted app finishes booting', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const app = createApp({ providers: [defineProvider({ name: 'slow', boot: () => gate })] })
    render(
      <Suspense fallback={<p>booting</p>}>
        <KitrProvider app={app}>
          <p>ready</p>
        </KitrProvider>
      </Suspense>,
    )
    expect(screen.getByText('booting')).toBeTruthy()
    await act(async () => release())
    expect(await screen.findByText('ready')).toBeTruthy()
  })

  it('useApp outside the provider explains itself', () => {
    function Lost() {
      useApp()
      return null
    }
    const spy = console.error
    console.error = () => {}
    try {
      expect(() => render(<Lost />)).toThrow(/inside <KitrProvider>/)
    } finally {
      console.error = spy
    }
  })
})

describe('KitrBoot', () => {
  it('shows the fallback, then the app', async () => {
    const app = createApp()
    render(
      <KitrBoot app={app} fallback={<p>wait</p>}>
        <p>done</p>
      </KitrBoot>,
    )
    expect(screen.getByText('wait')).toBeTruthy()
    expect(await screen.findByText('done')).toBeTruthy()
  })

  it('renders immediately for an app that already booted', async () => {
    const app = createApp()
    await app.boot()
    render(
      <KitrBoot app={app} fallback={<p>wait</p>}>
        <p>done</p>
      </KitrBoot>,
    )
    expect(screen.getByText('done')).toBeTruthy()
  })
})
