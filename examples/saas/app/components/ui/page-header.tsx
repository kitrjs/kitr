import { cn } from '@kitr/tailwind'
import type { ComponentProps, ReactNode } from 'react'

export interface PageHeaderProps extends Omit<ComponentProps<'header'>, 'title'> {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, description, actions, className, ...props }: PageHeaderProps) {
  return (
    <header
      className={cn('mb-6 flex flex-wrap items-start justify-between gap-4', className)}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}
