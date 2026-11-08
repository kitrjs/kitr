import { describe, expect, it } from 'vitest'
import theme from '../src/kitr'

const DOCUMENT = `import { HeadContent } from '@tanstack/react-router'

export function Document() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
    </html>
  )
}
`

/** A recording stand-in for the codemod context; `files` are what the project already has. */
function fakeCtx(files: Record<string, string>) {
  const rec = {
    files: { ...files },
    configs: {} as Record<string, string>,
    providers: [] as string[],
    removedProviders: [] as string[],
    agents: {} as Record<string, string>,
    removedAgents: [] as string[],
    imports: [] as Array<[string, string | undefined, string]>,
  }
  const ctx = {
    rc: { directories: { app: 'app' } },
    exists: (file: string) => file in rec.files,
    read: (file: string) => rec.files[file] ?? '',
    write: (file: string, src: string, opts?: { overwrite?: boolean }) => {
      if (file in rec.files && !opts?.overwrite) return false
      rec.files[file] = src
      return true
    },
    edit: (file: string, fn: (mod: unknown, src: string) => string) => {
      if (file in rec.files) rec.files[file] = fn(undefined, rec.files[file] as string)
    },
    config: (name: string, src: string) => {
      rec.configs[name] = src
    },
    replaceImport: (file: string, from: string | undefined, to: string) => {
      rec.imports.push([file, from, to])
    },
    provider: {
      add: (p: string) => rec.providers.push(p),
      remove: (p: string) => rec.removedProviders.push(p),
    },
    agents: {
      add: (name: string, text: string) => {
        rec.agents[name] = text
      },
      remove: (name: string) => rec.removedAgents.push(name),
    },
    log: { info: () => {}, warn: () => {} },
  }
  return { ctx: ctx as any, rec }
}

describe('theme setup module', () => {
  it('adds the provider, config, tokens and a no-flash ThemeScript in the document head', async () => {
    const { ctx, rec } = fakeCtx({ 'app/document.tsx': DOCUMENT })
    await theme.add!(ctx)
    expect(rec.providers).toEqual(['@kitr/theme/provider'])
    expect(rec.configs.theme).toContain("default: 'system'")
    expect(rec.files['app/styles/tokens.css']).toContain(':root')
    // Without Tailwind the overrides are linked from the document.
    expect(rec.imports).toEqual([['app/document.tsx', undefined, '#app/styles/tokens.css']])
    const doc = rec.files['app/document.tsx'] as string
    expect(doc).toContain("import { ThemeScript } from '@kitr/theme'")
    expect(doc).toContain('<html lang="en" suppressHydrationWarning>')
    expect(doc).toMatch(/<ThemeScript \/>\n\s*<HeadContent \/>/)
    expect(rec.agents.theme).toContain('useTheme()')

    // Adding twice leaves the document as it is.
    await theme.add!(ctx)
    expect(rec.files['app/document.tsx']).toBe(doc)

    await theme.remove!(ctx)
    expect(rec.files['app/document.tsx']).toBe(DOCUMENT)
    expect(rec.removedProviders).toEqual(['@kitr/theme/provider'])
    expect(rec.removedAgents).toEqual(['theme'])
  })

  it('imports the token overrides from app.css right after the kitr tokens when Tailwind owns styles', async () => {
    const { ctx, rec } = fakeCtx({
      'app/document.tsx': DOCUMENT,
      'app/styles/app.css': "@import 'tailwindcss';\n@import '@kitr/theme/styles.css';\n",
    })
    await theme.add!(ctx)
    expect(rec.files['app/styles/app.css']).toBe(
      "@import 'tailwindcss';\n@import '@kitr/theme/styles.css';\n@import './tokens.css';\n",
    )
    expect(rec.imports).toEqual([])
  })
})
