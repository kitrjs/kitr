import { definePackage, naming } from '@kitr/core/package'

const operation = (kind: 'query' | 'mutation') => ({
  description: `Create a server ${kind} in app/actions/<feature>/<name>.ts (define${naming.pascal(kind)})`,
  usage: '<feature>/<name>',
  definition:
    kind === 'query'
      ? "A server function the client reads by name: useQuery('projects.list')."
      : "A server function the client calls by name to change data: useMutation('projects.update').",
  target: (name: string, project: { rc: { directories: Record<string, string> } }) => {
    const [feature, op] = name.includes('/') ? (name.split('/') as [string, string]) : ['app', name]
    const dir = project.rc.directories.actions ?? `${project.rc.directories.app ?? 'app'}/actions`
    return { file: `${dir}/${feature}/${naming.kebab(op)}.ts`, vars: { feature, name: op } }
  },
})

/**
 * `kitr add actions`: defineQuery and defineMutation over TanStack Start server functions, with
 * names generated into `.kitr/actions.ts` by `kitr types` so `useQuery('projects.list')` is typed.
 */
export default definePackage({
  name: 'actions',
  requires: ['server', 'query'],
  client: true,
  add(ctx) {
    const dir = ctx.rc.directories.actions ?? `${ctx.rc.directories.app ?? 'app'}/actions`
    ctx.types.enable()
    ctx.write(`${dir}/.gitkeep`, '')
    ctx.app.option('operations', '#kitr/actions')
    ctx.agents.add(
      'actions',
      `- \`kitr make:query <feature>/<name>\` and \`kitr make:mutation <feature>/<name>\` write \`${dir}/<feature>/<name>.ts\` with \`defineQuery('<feature>.<name>', { input, staleTime, handler })\` or \`defineMutation('<feature>.<name>', { input, effects, handler })\`.\n- \`kitr types\` (run by \`kitr dev\` and \`kitr build\`) writes \`.kitr/actions.ts\`; \`app/app.ts\` passes its \`operations\` to \`createApp\`.\n- In components use the name: \`useQuery('projects.list', input)\`, \`useSuspenseQuery('projects.list', input)\`, \`useMutation('projects.update')\` from \`@kitr/query\`. In loaders use \`queryOptions('projects.list', input)\`. Outside React use \`call('projects.update', input)\` or import the definition and call it: \`await updateProject(input)\`.`,
    )
  },
  remove(ctx) {
    ctx.app.removeOption('operations', '#kitr/actions')
    ctx.agents.remove('actions')
  },
  types: () => import('./types'),
  generators: {
    query: {
      ...operation('query'),
      stub: ({ name, feature }) => `import { defineQuery } from '@kitr/actions'
import { z } from 'zod'

export const ${naming.camel(name)}Input = z.object({
  id: z.string(),
})

/** \`useQuery('${feature}.${naming.camel(name)}', { id })\` in a component; \`await ${naming.camel(name)}({ id })\` anywhere. */
export const ${naming.camel(name)} = defineQuery('${feature}.${naming.camel(name)}', {
  input: ${naming.camel(name)}Input,
  staleTime: 30_000,
  handler: async ({ input }) => {
    // const db = useDb<AppDb>(useRequestApp())
    return { id: input.id }
  },
})
`,
    },
    mutation: {
      ...operation('mutation'),
      stub: ({ name, feature }) => `import { defineMutation } from '@kitr/actions'
import { z } from 'zod'

export const ${naming.camel(name)}Input = z.object({
  id: z.string(),
})

/** \`useMutation('${feature}.${naming.camel(name)}')\` in a component; \`await ${naming.camel(name)}({ id })\` anywhere. */
export const ${naming.camel(name)} = defineMutation('${feature}.${naming.camel(name)}', {
  input: ${naming.camel(name)}Input,
  // What the mutation does to the client cache after success.
  effects: (_result, input) => ({ invalidate: [['${feature}', 'list'], ['${feature}', 'detail', input.id]] }),
  handler: async ({ input }) => {
    // const db = useDb<AppDb>(useRequestApp())
    return { ok: true, id: input.id }
  },
})
`,
    },
  },
  wraps: { '@tanstack/react-start': '@kitr/actions' },
  eject: { '@kitr/actions': '@tanstack/react-start (createServerFn)' },
})
