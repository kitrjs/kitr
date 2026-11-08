import { definePackage, generatorFile } from '@kitr/core/package'

const pascal = (s: string) =>
  s.replace(/(^|[-_/\s])(\w)/g, (_, __, c: string) => c.toUpperCase()).replace(/[^\w]/g, '')
const snake = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s/]+/g, '_')
    .toLowerCase()
const camel = (s: string) => {
  const p = pascal(s)
  return p.charAt(0).toLowerCase() + p.slice(1)
}

/**
 * `kitr add jobs`: config, an example job, the provider, and the AGENTS.md notes. One question:
 * whether the worker runs inside the server process or a separate one (`--no-worker`).
 */
export default definePackage({
  name: 'jobs',
  requires: ['server'],
  questions: [
    {
      name: 'worker',
      type: 'confirm',
      message: 'Run the job worker inside the server process?',
      default: true,
    },
  ],
  add(ctx) {
    const worker = ctx.answers.worker !== false
    ctx.provider.add('@kitr/jobs/provider')
    ctx.config(
      'jobs',
      `import { defineConfig } from '@kitr/jobs'\nimport { exampleJob } from '#server/jobs/example'\n\nexport default defineConfig({\n  // Every job the worker runs (kitr make:job <name> writes one in server/jobs/).\n  jobs: [exampleJob],\n  // In-memory queue by default: fine for one process. For several, pass a shared driver.\n  concurrency: 5,\n  worker: ${worker}, // ${worker ? 'false when a separate worker process runs the jobs' : 'the worker runs in its own process: `kitr jobs:work`'}\n})\n`,
    )
    ctx.write(
      'server/jobs/example.ts',
      `import { defineJob } from '@kitr/jobs'\nimport { z } from 'zod'\n\n/** Dispatch with \`useJobs(app).dispatch(exampleJob, { id })\`; it runs on the worker with retries. */\nexport const exampleJob = defineJob('example', {\n  schema: z.object({ id: z.string() }),\n  retries: 3,\n  // schedule: { every: '1h' },\n  async run({ id }, ctx) {\n    console.info(\`example job \${id} (attempt \${ctx.attempt})\`)\n  },\n})\n`,
    )
    if (!worker) ctx.scripts.add('worker', 'kitr jobs:work')
    ctx.agents.add(
      'jobs',
      `- Background work is a job in \`server/jobs/*.ts\` (\`kitr make:job <name>\`, \`defineJob\` with a schema, retries and an optional schedule), listed in \`config/jobs.ts\`. Dispatch from controllers and actions with \`ctx.app.container.use('jobs').dispatch(job, payload)\`; never \`setTimeout\` work in a request.${worker ? '' : '\n- The worker is a separate process: `kitr jobs:work` (the `worker` script). The server only dispatches.'}`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/jobs/provider')
    ctx.scripts.remove('worker', 'kitr jobs:work')
    ctx.agents.remove('jobs')
  },
  commands: () => import('./commands'),
  generators: {
    job: {
      description: 'Create a background job in server/jobs',
      definition:
        'A background unit of work with a payload schema, retries and an optional schedule.',
      target: (name, project) => generatorFile(project, 'server', 'jobs', name),
      stub: ({ name }) => `import { defineJob } from '@kitr/jobs'
import { z } from 'zod'

export const ${camel(name)}Input = z.object({
  id: z.string(),
})

/** List it in config/jobs.ts, then dispatch with \`useJobs(app).dispatch(${camel(name)}, { id })\`; it runs on the worker with retries. */
export const ${camel(name)} = defineJob('${snake(name)}', {
  schema: ${camel(name)}Input,
  retries: 3,
  // schedule: { every: '1h' },
  async run({ id }, ctx) {
    console.info(\`${snake(name)} \${id} (attempt \${ctx.attempt})\`)
  },
})
`,
    },
  },
  doctor(project) {
    if (!project.exists('config/jobs.ts')) return []
    const src = project.read('config/jobs.ts')
    if (/jobs\s*:\s*\[\s*\]/.test(src))
      return [
        {
          level: 'info',
          message: 'config/jobs.ts lists no jobs',
          fix: 'kitr make:job <name>, then add it to `jobs: [...]`',
        },
      ]
    return []
  },
  vite: { serverOnlyConfig: true },
})
