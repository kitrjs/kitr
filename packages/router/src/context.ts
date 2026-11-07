import type { KitrApp } from '@kitr/core'
import type { QueryClient } from '@tanstack/react-query'

/**
 * The router context every kitr route sees. Packages extend it by augmentation:
 *
 *   declare module '@kitr/router' { interface KitrRouterContext { session: Session | null } }
 */
export interface KitrRouterContext {
  queryClient: QueryClient
  app: KitrApp
}

export type RouterContextWith<T> = KitrRouterContext & T
