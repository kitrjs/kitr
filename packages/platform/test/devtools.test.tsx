import { createApp } from '@kitr/core'
import * as ui from '@kitr/devtools/ui'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { panels } from '../src/devtools'
import platformProvider from '../src/provider'

afterEach(cleanup)

describe('platform panel', () => {
  it('renders the os stat, safe area and the drivers empty state', async () => {
    const app = createApp({ providers: [platformProvider] })
    await app.boot()
    const platform = app.container.use('platform')
    const panel = panels(app, ui)[0]!
    expect(panel.group).toBe('platform')
    render(panel.render(app) as any)
    expect(screen.getByText('OS')).toBeTruthy()
    expect(screen.getByText(String(platform.os))).toBeTruthy()
    expect(screen.getByText('Safe area')).toBeTruthy()
    expect(screen.getByText('Browser defaults')).toBeTruthy()
  })
})
