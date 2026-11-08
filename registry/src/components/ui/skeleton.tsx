import { cn } from '@kitr/tailwind'
import type { ComponentProps } from 'react'

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}
