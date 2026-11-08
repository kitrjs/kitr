import { describe, expectTypeOf, it } from 'vitest'
import type { Analytics } from '../src'

type AppEvents = {
  'project.created': { id: string }
  'signed.out': undefined
}

describe('typed events', () => {
  it('accepts only names from the event map, with their props', () => {
    const analytics = {} as Analytics<AppEvents>
    analytics.track('project.created', { id: 'p1' })
    analytics.track('signed.out')
    expectTypeOf(analytics.track<'signed.out'>).parameters.toEqualTypeOf<['signed.out']>()
    // @ts-expect-error not in the event map
    analytics.track('project.deleted', { id: 'p1' })
    // @ts-expect-error wrong props
    analytics.track('project.created', { name: 'x' })
  })

  it('accepts anything without an event map', () => {
    const analytics = {} as Analytics
    expectTypeOf(analytics.track).toBeCallableWith('anything', { n: 1 })
  })
})
