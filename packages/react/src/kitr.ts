import { definePackage, generatorFile, naming } from '@kitr/core/package'

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
    // The blank base compiles for Node only; React brings the browser types and JSX with it.
    ctx.tsconfig.addLib('DOM', 'DOM.Iterable')
    ctx.tsconfig.set('jsx', 'react-jsx')
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
  doctor(project) {
    if (project.has('react')) return []
    return [
      {
        level: 'error',
        message: 'react is not installed',
        fix: `${project.pm} add react react-dom`,
      },
    ]
  },
  generators: {
    component: {
      description: 'Create a React component in app/components',
      definition: 'A reusable piece of UI with no route of its own.',
      target: (name, project) => generatorFile(project, 'components', '', name, { ext: '.tsx' }),
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
      definition: 'A use* function that packages React state or effects for reuse.',
      target: (name, project) =>
        generatorFile(project, 'app', 'hooks', name.replace(/(^|\/)use(?:[-_]|(?=[A-Z]))/, '$1'), {
          prefix: 'use-',
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
  vite: {
    plugin: '@vitejs/plugin-react',
    optimizeDeps: ['react', 'react-dom', 'react/jsx-runtime'],
  },
})
