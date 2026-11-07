export * from '@tanstack/react-query'
export * from './contract'
export * from './effects'
// Explicit, so these names win over the star re-export of TanStack's own.
export { call, queryOptions, useMutation, useQuery, useSuspenseQuery } from './named'
export * from './provider'
export * from './subscription'
