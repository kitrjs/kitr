import { describe, expect, it } from 'vitest'
import { cssImportEdit } from '../src/codemods'

// The shape @kitr/router writes for Start's root route.
const root = `import { HeadContent } from '@kitr/router'
import type { ReactNode } from 'react'
import css0 from '@kitr/theme/styles.css?url'

export const Route = createRootRouteWithContext<KitrRouterContext>()({
  head: () => ({
    links: [{ rel: 'stylesheet', href: css0 }],
  }),
})
`

describe('cssImportEdit', () => {
  // Regression: tailwind added app.css next to the linked theme sheet, so the theme loaded twice.
  it('swaps a ?url stylesheet link instead of adding a second sheet', () => {
    const out = cssImportEdit(root, '@kitr/theme/styles.css', '#app/styles/app.css')
    expect(out).toContain("import css0 from '#app/styles/app.css?url'")
    expect(out).not.toContain('@kitr/theme/styles.css')
    expect(out).not.toContain("import '#app/styles/app.css'")
    expect(cssImportEdit(out, '@kitr/theme/styles.css', '#app/styles/app.css')).toBe(out)
  })

  it('adds a new sheet as another link when the file links its CSS', () => {
    const out = cssImportEdit(root, undefined, '#app/styles/tokens.css')
    expect(out).toContain("import css1 from '#app/styles/tokens.css?url'")
    expect(out).toContain(
      "links: [{ rel: 'stylesheet', href: css0 }, { rel: 'stylesheet', href: css1 }]",
    )
    expect(cssImportEdit(out, undefined, '#app/styles/tokens.css')).toBe(out)
  })

  it('keeps side-effect imports as they are', () => {
    const src = "import { x } from 'y'\nimport '@kitr/theme/styles.css'\n\nexport {}\n"
    expect(cssImportEdit(src, '@kitr/theme/styles.css', '#app/styles/app.css')).toBe(
      "import { x } from 'y'\nimport '#app/styles/app.css'\n\nexport {}\n",
    )
    expect(cssImportEdit("import { x } from 'y'\n\nexport {}\n", undefined, 'a.css')).toBe(
      "import { x } from 'y'\nimport 'a.css'\n\nexport {}\n",
    )
  })
})
