import { useTheme } from '@kitr/theme'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

/** Mount once in the root route; call `toast()` from `sonner` anywhere. Follows the kitr theme. */
export function Toaster(props: ToasterProps) {
  const { resolved } = useTheme()
  return <Sonner theme={resolved} position="bottom-right" richColors {...props} />
}

export { toast } from 'sonner'
