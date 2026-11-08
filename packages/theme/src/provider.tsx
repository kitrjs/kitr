import { defineProvider } from '@kitr/core'
import type { ReactNode } from 'react'
import type { ThemeConfig } from './config'
import { ThemeConfigContext, ThemeProvider } from './theme'

/**
 * Wraps the app in ThemeProvider with `config/theme.ts`.
 * Listed in kitrrc.ts as `() => import('@kitr/theme/provider')`. Pair with `<ThemeScript />` in the document head.
 */
export const themeProvider = defineProvider({
  name: 'theme',
  wrap(children, app) {
    const config = app.config.get('theme', {} as ThemeConfig)
    return (
      <ThemeConfigContext.Provider value={config}>
        <ThemeProvider
          defaultTheme={config.default}
          storageKey={config.storageKey}
          attribute={config.attribute}
          colors={config.colors}
        >
          {children as ReactNode}
        </ThemeProvider>
      </ThemeConfigContext.Provider>
    )
  },
})

export default themeProvider
