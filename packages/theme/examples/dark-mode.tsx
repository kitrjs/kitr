import { ThemeProvider, useTheme } from '@kitr/theme'

export const meta = {
  title: 'Light, dark or system, remembered',
  description: 'Pick a theme and the frame switches. Reload keeps your choice.',
}

// Tailwind utilities on the kitr tokens, so the example looks the same in any kitr app.
const button =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-border bg-background text-foreground'
const primary =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-primary bg-primary text-primary-foreground'

function Picker() {
  const { theme, resolved, setTheme, toggle } = useTheme()
  return (
    <div className="flex flex-col gap-3 text-[15px]">
      <div className="flex flex-wrap gap-2">
        {(['light', 'dark', 'system'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={theme === t ? primary : button}
            onClick={() => setTheme(t)}
            aria-pressed={theme === t}
          >
            {t}
          </button>
        ))}
        <button type="button" className={button} onClick={() => toggle()}>
          Toggle
        </button>
      </div>
      <p className="m-0 text-muted-foreground">
        Choice <span className="font-mono">{theme}</span>, on screen{' '}
        <span className="font-mono">{resolved}</span>. With{' '}
        <span className="font-mono">system</span>, it follows your operating system.
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
