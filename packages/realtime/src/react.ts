import { subscriptionFrom, type UseSubscriptionOptions, useSubscription } from '@kitr/query'
import { useEffect, useState } from 'react'
import { type ChannelHandle, channel, type SocketStatus, type SocketTransport } from './client'
import type { ChannelDefinition, ChannelEventUnion, ChannelParams } from './protocol'

/**
 * Subscribe a component to a channel: `useChannel(realtime(), chatChannel, { room })`.
 * Events run the channel's cache `effects`; the hook also returns the last event and status.
 */
export function useChannel<C extends ChannelDefinition<any, any>>(
  transport: SocketTransport,
  definition: C,
  params: ChannelParams<C>,
  options: UseSubscriptionOptions<ChannelEventUnion<C>> = {},
) {
  const [handle] = useState<ChannelHandle<C>>(() => channel(transport, definition))
  const [subscription] = useState(() => subscriptionFrom(handle.subscription()))
  return useSubscription(subscription, params, options)
}

/** `'connecting' | 'open' | 'closed'` for a connection indicator. */
export function useRealtimeStatus(transport: SocketTransport | undefined): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>(transport?.status ?? 'closed')
  useEffect(() => {
    if (!transport) return
    setStatus(transport.status)
    return transport.onStatus(setStatus)
  }, [transport])
  return status
}
