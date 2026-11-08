import { createApp } from '@kitr/core'
import { createDevtoolsHub } from '@kitr/devtools'
import * as ui from '@kitr/devtools/ui'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { memoryAdapter } from '../src'
import { panels } from '../src/devtools'
import analyticsProvider from '../src/provider'

afterEach(cleanup)

describe('analytics panel', () => {
  it('flips the state badge after enable and lists events', async () => {
    const hub = createDevtoolsHub()
    const app = createApp({
      providers: [analyticsProvider],
      config: { analytics: { adapters: [memoryAdapter()] } },
    })
    app.container.value('devtools', hub)
    await app.boot()
    await app.container.use('analytics').disable()
    const panel = panels(app, ui)[0]!
    render(panel.render(app) as any)
    expect(screen.getByText('queued')).toBeTruthy()
    expect(screen.getByText('No events')).toBeTruthy()
    cleanup()

    await app.container.use('analytics').enable()
    app.container.use('analytics').track('clicked')
    render(panel.render(app) as any)
    expect(screen.getByText('enabled')).toBeTruthy()
    expect(screen.getByText('track clicked')).toBeTruthy()
    expect(panel.badge?.(app)).toEqual({ value: 1, tone: 'muted' })
  })
})
