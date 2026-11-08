import { useEffect, useRef, useState } from 'react'
import { Icon, icons } from './icons'

type Theme = 'light' | 'dark'

/** The page background per theme: the browser's own bar (theme-color) is painted to match it. */
const chrome = { light: '#ffffff', dark: '#0b121c' } as const

/**
 * Points the browser's bar (theme-color) and built-in controls (color-scheme) at the theme the
 * site shows, which may not be the system's. The script below writes these two tags itself rather
 * than the route's head(): the router renders its own copy of head tags on the client, and two
 * theme-color tags disagreeing leave the browser picking one.
 */
const chromeScript = `var c=t==='dark'?'${chrome.dark}':'${chrome.light}';[['theme-color',c],['color-scheme',t]].forEach(function(p){var m=document.querySelector('meta[name="'+p[0]+'"]');if(!m){m=document.createElement('meta');m.name=p[0];document.head.appendChild(m)}m.content=p[1]})`

function syncChrome(t: Theme) {
  const tags: Array<[string, string]> = [
    ['theme-color', chrome[t]],
    ['color-scheme', t],
  ]
  for (const [name, content] of tags) {
    let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = name
      document.head.appendChild(meta)
    }
    meta.content = content
  }
}

/** Runs before paint (inlined in <head>) so the page never flashes the wrong theme. */
export const themeScript = `try{var t=localStorage.getItem('kitr:theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;${chromeScript}}catch(e){}`

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  }, [])
  const button = useRef<HTMLButtonElement>(null)
  const toggle = () => {
    const root = document.documentElement
    const next = theme === 'light' ? 'dark' : 'light'
    const apply = (animate: boolean) => {
      root.dataset.theme = next
      syncChrome(next)
      // Only the icon that appears in the new snapshot turns in; see motion.css.
      if (animate) root.classList.add('theme-swapped')
      try {
        localStorage.setItem('kitr:theme', next)
      } catch {}
      setTheme(next)
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduced) {
      apply(false)
      return
    }
    // The new theme is revealed as a circle growing from the button.
    const rect = button.current?.getBoundingClientRect()
    root.style.setProperty('--theme-x', `${rect ? rect.left + rect.width / 2 : 0}px`)
    root.style.setProperty('--theme-y', `${rect ? rect.top + rect.height / 2 : 0}px`)
    root.classList.add('theme-switching')
    // A route's direction marker left on <html> would otherwise switch this transition's animations off.
    delete root.dataset.nav
    document
      .startViewTransition(() => apply(true))
      .finished.finally(() => {
        root.classList.remove('theme-switching', 'theme-swapped')
      })
  }
  // Both icons are rendered and CSS shows the one for the current theme, so a dark-mode visitor sees
  // the sun from the first paint instead of a moon that swaps once React hydrates.
  return (
    <button
      type="button"
      ref={button}
      className="icon-button theme-toggle"
      onClick={toggle}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <span className="theme-icon theme-icon-moon">
        <Icon icon={icons.moon} />
      </span>
      <span className="theme-icon theme-icon-sun">
        <Icon icon={icons.sun} />
      </span>
    </button>
  )
}
