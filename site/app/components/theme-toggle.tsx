import { useEffect, useState } from 'react'
import { Icon, icons } from './icons'

type Theme = 'light' | 'dark'

/** Runs before paint (inlined in <head>) so the page never flashes the wrong theme. */
export const themeScript = `try{var t=localStorage.getItem('kitr:theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  }, [])
  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('kitr:theme', next)
    } catch {}
    setTheme(next)
  }
  return (
    <button
      type="button"
      className="icon-button"
      onClick={toggle}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <Icon icon={theme === 'light' ? icons.moon : icons.sun} />
    </button>
  )
}
