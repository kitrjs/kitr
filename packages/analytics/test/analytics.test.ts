import { describe, expect, it } from 'vitest'
import { createAnalytics, memoryAdapter } from '../src'

describe('analytics', () => {
  it('sends page/track/identify to every adapter with global props', async () => {
    const a = memoryAdapter()
    const b = memoryAdapter()
    const analytics = createAnalytics({ adapters: [a, b], globalProps: { app: 'test' } })
    await analytics.enable()
    analytics.page('/projects', { title: 'Projects' })
    analytics.track('project.created', { id: '1' })
    analytics.identify('u1', { plan: 'pro' })
    expect(a.calls).toEqual([
      { type: 'page', args: ['/projects', { app: 'test', title: 'Projects' }] },
      { type: 'track', args: ['project.created', { app: 'test', id: '1' }] },
      { type: 'identify', args: ['u1', { plan: 'pro' }] },
    ])
    expect(b.calls).toHaveLength(3)
  })

  it('queues until enable() so a consent banner can gate everything', async () => {
    const a = memoryAdapter()
    const analytics = createAnalytics({ adapters: [a], enabled: false })
    analytics.track('early')
    expect(a.calls).toEqual([])
    expect(analytics.enabled).toBe(false)
    await analytics.enable()
    expect(a.calls).toEqual([{ type: 'track', args: ['early', undefined] }])
    analytics.disable()
    analytics.track('dropped')
    expect(a.calls).toHaveLength(1)
  })

  it('never lets a failing adapter break the caller', async () => {
    const good = memoryAdapter()
    const analytics = createAnalytics({
      adapters: [
        {
          name: 'broken',
          page: () => {
            throw new Error('blocked')
          },
          track: () => Promise.reject(new Error('blocked')),
        },
        good,
      ],
    })
    await analytics.enable()
    expect(() => analytics.page('/')).not.toThrow()
    expect(() => analytics.track('x')).not.toThrow()
    expect(good.calls).toHaveLength(2)
  })
})
