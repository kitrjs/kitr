import { createApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { act, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineFlags, FLAGS_SCRIPT_ID, staticFlagsProvider } from '../src'
import flagsProvider from '../src/provider'
import { FlagsScript, useFlag, useFlags } from '../src/react'

const definitions = defineFlags({ beta: { default: false }, pageSize: { default: 20 } })

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function All() {
  const flags = useFlags<typeof definitions>()
  return <pre data-testid="all">{JSON.stringify(flags)}</pre>
}

function Beta() {
  return <span data-testid="beta">{String(useFlag<typeof definitions, 'beta'>('beta'))}</span>
}

describe('flags in React', () => {
  it('useFlags renders without an update loop and follows hydrate', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = createApp({
      environment: 'client',
      providers: [flagsProvider],
      config: { flags: { definitions } },
    })
    await app.boot()
    render(
      <KitrProvider app={app}>
        <All />
        <Beta />
      </KitrProvider>,
    )
    expect(JSON.parse(screen.getByTestId('all').textContent!)).toEqual({
      beta: false,
      pageSize: 20,
    })
    act(() => app.container.use('flags').hydrate({ beta: true }))
    expect(screen.getByTestId('beta').textContent).toBe('true')
    expect(JSON.parse(screen.getByTestId('all').textContent!).beta).toBe(true)
    expect(error).not.toHaveBeenCalledWith(
      expect.stringMatching(/getSnapshot|Maximum update depth/),
      expect.anything(),
    )
  })

  it('boots from the snapshot the server embedded, without calling providers', async () => {
    const resolve = vi.fn(() => true)
    document.head.innerHTML = `<script type="application/json" id="${FLAGS_SCRIPT_ID}">{"beta":true,"pageSize":"50"}</script>`
    const app = createApp({
      environment: 'client',
      providers: [flagsProvider],
      config: { flags: { definitions, providers: [{ name: 'spy', resolve }] } },
    })
    await app.boot()
    expect(app.container.use('flags').snapshot()).toEqual({ beta: true, pageSize: 50 })
    expect(resolve).not.toHaveBeenCalled()
  })

  it('resolves at boot when nothing is embedded, and survives a broken embed', async () => {
    document.head.innerHTML = `<script type="application/json" id="${FLAGS_SCRIPT_ID}">{not json</script>`
    const app = createApp({
      environment: 'client',
      providers: [flagsProvider],
      config: { flags: { definitions, providers: [staticFlagsProvider({ beta: true })] } },
    })
    await app.boot()
    expect(app.container.use('flags').value('beta')).toBe(true)
  })

  it('FlagsScript escapes markup in values', () => {
    const html = renderToString(
      <FlagsScript values={{ x: '</script><img src=x onerror=alert(1)>' }} />,
    )
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    expect(html).not.toContain('<img')
  })
})
