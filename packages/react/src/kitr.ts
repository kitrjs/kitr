import { definePackage, naming } from '@kitr/core/package'

/**
 * `kitr add react`: React, the app object (`app/app.ts`) and the typed env (`app/env.ts`).
 * Every UI platform requires it through `router`.
 */
export default definePackage({
  name: 'react',
  client: true,
  add(ctx) {
    ctx.deps.add(
      'react',
      'react-dom',
      { name: '@vitejs/plugin-react', dev: true },
      { name: '@types/react', dev: true },
      { name: '@types/react-dom', dev: true },
    )
    ctx.write(
      'app/env.ts',
      `import { createEnv, env as e } from 'kitr/env'\n\n/** Validated at startup. Public vars (VITE_*) ship to the browser; server vars throw if read there. */\nexport const env = createEnv({\n  public: {\n    VITE_APP_NAME: e.string({ default: '${ctx.pkg.name ?? 'app'}' }),\n  },\n  server: {},\n})\n`,
    )
    ctx.write(
      'app/app.ts',
      `import { createApp } from 'kitr/app'\nimport { config } from 'virtual:kitr/config'\nimport { providers } from 'virtual:kitr/providers'\nimport { env } from './env'\n\n/** One app object: providers from kitrrc.ts, config from config/*.ts, both as static imports. */\nexport const app = createApp({ providers, config, env })\n`,
    )
  },
  remove(ctx) {
    ctx.deps.remove(
      'react',
      'react-dom',
      '@vitejs/plugin-react',
      '@types/react',
      '@types/react-dom',
    )
  },
  generators: {
    component: {
      description: 'Create a React component in app/components',
      target: (name, project) => ({
        file: `${project.rc.directories.components ?? 'app/components'}/${naming.kebab(name)}.tsx`,
      }),
      stub: ({ name }) => `import type { ReactNode } from 'react'

export interface ${naming.pascal(name)}Props {
  children?: ReactNode
  className?: string
}

export function ${naming.pascal(name)}({ children, className }: ${naming.pascal(name)}Props) {
  return <div className={className}>{children}</div>
}
`,
    },
    hook: {
      description: 'Create a React hook in app/hooks',
      target: (name, project) => ({
        file: `${project.rc.directories.app ?? 'app'}/hooks/use-${naming.kebab(name)}.ts`,
      }),
      stub: ({ name }) => `import { useCallback, useState } from 'react'

export function use${naming.pascal(name)}(initial = false) {
  const [value, setValue] = useState(initial)
  const toggle = useCallback(() => setValue((v) => !v), [])
  return { value, setValue, toggle }
}
`,
    },
  },
  vite: { optimizeDeps: ['react', 'react-dom'] },
})
