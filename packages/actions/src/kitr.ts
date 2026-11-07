import { definePackage, naming } from '@kitr/core/package'

/** `kitr add actions`: defineAction over TanStack Start server functions, with `kitr make:action`. */
export default definePackage({
  name: 'actions',
  requires: ['server'],
  client: true,
  add(ctx) {
    ctx.write('app/actions/.gitkeep', '')
    ctx.agents.add(
      'actions',
      `- \`kitr make:action <feature>/<name>\` writes \`app/actions/<feature>/<name>.ts\` with \`defineAction('<feature>.<name>', { input, effects, handler })\`.\n- Call actions from anywhere: \`await updateProject(input)\`; in components use \`useKitrMutation(defineMutation(updateProject.mutation()))\`. GET actions expose \`.query()\` for loaders.`,
    )
  },
  remove(ctx) {
    ctx.agents.remove('actions')
  },
  generators: {
    action: {
      description: 'Create a server action in app/actions/<feature>/<name>.ts',
      target: (name, project) => {
        const [feature, action] = name.includes('/')
          ? (name.split('/') as [string, string])
          : ['app', name]
        return {
          file: `${project.rc.directories.app ?? 'app'}/actions/${feature}/${naming.snake(action)}.ts`,
          vars: { feature, name: action },
        }
      },
      stub: ({ name, feature }) => `import { defineAction } from 'kitr/actions'
import { z } from 'zod'

export const ${naming.camel(name)}Input = z.object({
  id: z.string(),
})

export const ${naming.camel(name)} = defineAction('${feature}.${naming.camel(name)}', {
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
  wraps: { '@tanstack/react-start': 'kitr/actions' },
  eject: { 'kitr/actions': '@tanstack/react-start (createServerFn)' },
})
