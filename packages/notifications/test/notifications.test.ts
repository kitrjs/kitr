import { createApp } from '@kitr/core'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryNotificationsDriver, createNotifications } from '../src'
import notificationsProvider from '../src/provider'

describe('notifications', () => {
  it('shows, schedules, cancels and reports taps with the url', async () => {
    const driver = createMemoryNotificationsDriver('prompt')
    const n = createNotifications({ driver })
    expect(await n.permission()).toBe('prompt')
    expect(await n.request()).toBe('granted')
    const id = await n.show({ title: 'Hi', url: '/inbox/1' })
    const later = await n.schedule({ id: 'later', title: 'Later', at: Date.now() + 1000 })
    expect(later).toBe('later')
    expect(await n.pending()).toEqual(['later'])
    const tap = vi.fn()
    n.onTap(tap)
    driver.tap(id)
    expect(tap).toHaveBeenCalledWith({ id, url: '/inbox/1', data: undefined })
    await n.cancel('later')
    expect(await n.pending()).toEqual([])
    await n.schedule({ title: 'x', at: Date.now() + 5 })
    await n.cancelAll()
    expect(await n.pending()).toEqual([])
  })

  it('requests on boot when configured and prefers the registered driver', async () => {
    const driver = createMemoryNotificationsDriver('prompt')
    const app = createApp({
      environment: 'client',
      providers: [notificationsProvider],
      config: { notifications: { requestOnBoot: true } },
    })
    app.drivers.register('notifications', driver)
    await app.boot()
    expect(await app.container.use('notifications').permission()).toBe('granted')
  })
})
