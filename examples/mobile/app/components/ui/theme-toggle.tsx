import { useTheme } from 'kitr/ui'
import { Button } from '#components/ui/button'

export function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
    >
      {resolved === 'dark' ? '☀' : '☾'}
    </Button>
  )
}
