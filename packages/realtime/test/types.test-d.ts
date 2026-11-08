import type { StandardSchemaV1 } from '@kitr/core'
import { describe, expectTypeOf, it } from 'vitest'
import { type ChannelEventUnion, type ChannelParams, channel, defineChannel } from '../src'

declare const Params: StandardSchemaV1<unknown, { id: string }>
declare const Project: StandardSchemaV1<unknown, { id: string; name: string }>

const projects = defineChannel({
  name: 'projects',
  params: Params,
  events: {
    updated: { schema: Project },
    deleted: {},
  },
})

describe('channel types', () => {
  it('infers params and a discriminated event union', () => {
    expectTypeOf<ChannelParams<typeof projects>>().toEqualTypeOf<{ id: string }>()
    type U = ChannelEventUnion<typeof projects>
    expectTypeOf<Extract<U, { event: 'updated' }>['data']>().toEqualTypeOf<{
      id: string
      name: string
    }>()
    expectTypeOf<U['event']>().toEqualTypeOf<'updated' | 'deleted'>()
  })

  it('types effects from the payload schema and params', () => {
    defineChannel({
      name: 'x',
      params: Params,
      events: {
        updated: {
          schema: Project,
          effects: (data, params) => {
            expectTypeOf(data).toEqualTypeOf<{ id: string; name: string }>()
            expectTypeOf(params).toEqualTypeOf<{ id: string }>()
          },
        },
      },
    })
  })

  it('handle methods take the channel params and known event names', () => {
    const handle = channel({} as any, projects)
    handle.send({ id: '1' }, 'updated', {})
    // @ts-expect-error unknown event
    handle.send({ id: '1' }, 'renamed', {})
    // @ts-expect-error params shape
    handle.key({ slug: 'x' })
  })
})

describe('channels without a payload schema', () => {
  it('accept an annotated effects payload', () => {
    interface Message {
      text: string
    }
    defineChannel<{ room: string }>({
      name: 'chat',
      events: {
        message: { effects: (_m: Message, { room }) => ({ invalidate: [['chat', room]] }) },
      },
    })
  })
})
