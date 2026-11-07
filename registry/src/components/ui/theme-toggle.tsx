import { Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons'
import { useTheme } from 'kitr/theme'
import { Button } from '#components/ui/button'
import { Icon } from '#components/ui/icon'

export function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
    >
      <Icon icon={resolved === 'dark' ? Sun03Icon : Moon02Icon} size={18} />
    </Button>
  )
}
