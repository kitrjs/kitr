import { cn } from 'kitr/tailwind'
import { type ComponentProps, type ReactNode, useEffect, useRef } from 'react'

export interface DialogProps extends Omit<ComponentProps<'dialog'>, 'open'> {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

/** Controlled modal on <dialog>: focus trap, Escape and backdrop close come from the browser. */
export function Dialog({ open, onOpenChange, className, children, ...props }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click only; Escape is handled natively by <dialog> via onClose
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === ref.current) onOpenChange(false)
      }}
      className={cn(
        'w-full max-w-lg rounded-lg border border-border bg-background p-0 text-foreground shadow-md backdrop:bg-black/50 open:animate-in',
        className,
      )}
      {...props}
    >
      <div className="p-6">{children}</div>
    </dialog>
  )
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mb-4 flex flex-col gap-1.5', className)} {...props} />
}
export function DialogTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-lg font-semibold leading-none', className)} {...props} />
}
export function DialogDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}
export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mt-6 flex justify-end gap-2', className)} {...props} />
}
