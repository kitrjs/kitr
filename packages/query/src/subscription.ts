import type { KitrErrorShape } from '@kitr/core'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { SubscriptionDefinition } from './contract'
import { applyCacheEffect } from './effects'

export interface UseSubscriptionOptions<TEvent> {
  enabled?: boolean
  onEvent?: (event: TEvent) => void
  onError?: (error: KitrErrorShape) => void
}

/**
 * Subscribe to a socket channel, SSE stream or anything else that fits the
 * subscription contract. Events flow into the query cache via `effects`,
 * so a live update lands in the same entry `useQuery` reads.
 */
export function useSubscription<TInput, TEvent>(
  definition: SubscriptionDefinition<TInput, TEvent>,
  input: TInput,
  options: UseSubscriptionOptions<TEvent> = {},
) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'idle' | 'open' | 'error'>('idle')
  const [lastEvent, setLastEvent] = useState<TEvent>()
  const [error, setError] = useState<KitrErrorShape>()
  const handlers = useRef(options)
  handlers.current = options
  const key = JSON.stringify(definition.key(input))

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the stable serialisation of `input`
  useEffect(() => {
    if (options.enabled === false) return
    setStatus('open')
    const unsubscribe = definition.contract.subscribe(input, {
      next: (event) => {
        setLastEvent(event)
        handlers.current.onEvent?.(event)
        void applyCacheEffect(queryClient, definition.contract.effects?.(event, input))
      },
      error: (e) => {
        setError(e)
        setStatus('error')
        handlers.current.onError?.(e)
      },
    })
    return () => {
      unsubscribe()
      setStatus('idle')
    }
  }, [key, definition, queryClient, options.enabled])

  return { status, lastEvent, error }
}
