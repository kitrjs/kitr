import { ThemeProvider, useTheme } from '@kitr/theme'

export const meta = {
  title: 'Light, dark or system, remembered',
  description: 'Pick a theme and the frame switches. Reload keeps your choice.',
}

function Picker() {
  const { theme, resolved, setTheme, toggle } = useTheme()
  return (
    <div className="demo">
      <div className="demo-row">
        {(['light', 'dark', 'system'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`demo-button${theme === t ? ' primary' : ''}`}
            onClick={() => setTheme(t)}
            aria-pressed={theme === t}
          >
            {t}
          </button>
        ))}
        <button type="button" className="demo-button" onClick={toggle}>
          Toggle
        </button>
      </div>
      <p className="demo-muted">
        Choice <span className="mono">{theme}</span>, on screen{' '}
        <span className="mono">{resolved}</span>. With <span className="mono">system</span>, it
        follows your operating system.
      </p>
    </div>
  )
}

export default function DarkMode() {
  return (
    <ThemeProvider defaultTheme="system">
      <Picker />
    </ThemeProvider>
  )
}
