import { definePackage, generatorFile, naming } from '@kitr/core/package'

/** `kitr add http`: the ky client with auth headers, token refresh and kitr error normalisation. */
export default definePackage({
  name: 'http',
  client: true,
  requires: ['query'],
  add(ctx) {
    ctx.deps.add('ky')
    ctx.provider.add('@kitr/http/provider')
    ctx.env.schema(
      'public',
      'VITE_API_URL',
      "e.url({ default: 'http://localhost:3333' })",
      'http://localhost:3333',
    )
    ctx.config(
      'http',
      `import { defineConfig } from '@kitr/http'\nimport { env } from '#app/env'\n\nexport default defineConfig({\n  baseUrl: env.VITE_API_URL,\n  // getToken: () => auth.getToken(), refresh: () => auth.refresh(),\n})\n`,
    )
    ctx.agents.add(
      'http',
      `- The HTTP client is \`app.container.use('http')\` (a ky instance). Wrap endpoints with \`httpQuery\`/\`httpMutation\` from \`@kitr/http\` and pass them to \`queryFrom\`/\`mutationFrom\`.\n- Errors are already \`KitrError\`; a 422 with \`fieldErrors\` maps onto form fields through \`<Form>\`.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/http/provider')
    ctx.deps.remove('ky')
    ctx.agents.remove('http')
  },
  generators: {
    queries: {
      description: 'Create the typed queries and mutations of one HTTP resource in app/queries',
      definition:
        'Typed query and mutation contracts for an external HTTP API, one file per resource.',
      target: (name, project) => generatorFile(project, 'app', 'queries', name),
      stub: ({ name }) => `import { createKeys } from '@kitr/kitr/app'
import { mutationFrom, queryFrom } from '@kitr/query'
import { httpMutation, httpQuery } from '@kitr/http'
import { app } from '#app/app'

// A function: this file loads with the route table, before the app has booted.
const http = () => app.container.use('http')
export const ${naming.camel(name)}Keys = createKeys('${naming.snake(name)}')

export interface ${naming.pascal(name)} {
  id: string
  name: string
}

export const ${naming.camel(name)}ListQuery = queryFrom(
  httpQuery<void, ${naming.pascal(name)}[]>(http, { path: '${naming.snake(name)}', key: () => ${naming.camel(name)}Keys.list() }),
)

export const ${naming.camel(name)}Query = queryFrom(
  httpQuery<string, ${naming.pascal(name)}>(http, { path: (id) => \`${naming.snake(name)}/\${id}\`, key: (id) => ${naming.camel(name)}Keys.detail(id) }),
)

export const update${naming.pascal(name)} = mutationFrom(
  httpMutation<Partial<${naming.pascal(name)}> & { id: string }, ${naming.pascal(name)}>(http, {
    method: 'patch',
    path: (input) => \`${naming.snake(name)}/\${input.id}\`,
    effects: (result) => ({ set: [{ key: ${naming.camel(name)}Keys.detail(result.id), data: result }], invalidate: [${naming.camel(name)}Keys.lists()] }),
  }),
)
`,
    },
  },
  wraps: { ky: '@kitr/http' },
  eject: { '@kitr/http': 'ky' },
  vite: { optimizeDeps: ['ky'] },
})
