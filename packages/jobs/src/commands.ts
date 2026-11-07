import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Job } from './index'

/**
 * `kitr jobs:list` and `kitr jobs:work`. Plain command objects (citty's shape) so this module
 * needs no CLI dependency; the kitr CLI mounts them when `@kitr/jobs` is in kitrrc.ts.
 */

async function loadJobsConfig(root: string) {
  const file = ['config/jobs.ts', 'config/jobs.js', 'config/jobs.mts']
    .map((f) => resolve(root, f))
    .find(existsSync)
  if (!file) throw new Error('No config/jobs.ts in this project. Run `kitr add jobs`.')
  const { createJiti } = await import('jiti')
  const jiti = createJiti(file, { interopDefault: true, alias: aliases(root) })
  const mod = (await jiti.import(file)) as { default?: { jobs?: Job<any>[] } } & {
    jobs?: Job<any>[]
  }
  const config = mod.default ?? mod
  return { file, jobs: config.jobs ?? [] }
}

function aliases(root: string): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    const ts = JSON.parse(readFileSync(resolve(root, 'tsconfig.json'), 'utf8')) as {
      compilerOptions?: { paths?: Record<string, string[]> }
    }
    for (const [k, v] of Object.entries(ts.compilerOptions?.paths ?? {}))
      out[k.replace('/*', '')] = resolve(root, v[0]!.replace('/*', ''))
  } catch {}
  return out
}

export const list = {
  meta: {
    name: 'jobs:list',
    description: 'List the jobs in config/jobs.ts with their retries and schedules.',
  },
  args: { json: { type: 'boolean', description: 'Print as JSON', default: false } },
  async run({ args }: { args: { json: boolean } }) {
    const { jobs } = await loadJobsConfig(process.cwd())
    const rows = jobs.map((j) => ({
      name: j.name,
      retries: j.retries ?? 3,
      timeout: j.timeout ?? 60_000,
      schedule:
        typeof j.schedule === 'string' ? j.schedule : j.schedule ? `every ${j.schedule.every}` : '',
    }))
    if (args.json) return console.log(JSON.stringify(rows, null, 2))
    if (!rows.length)
      return console.log('No jobs in config/jobs.ts. `kitr make:job <name>` writes one.')
    const w = Math.max(...rows.map((r) => r.name.length), 4)
    console.log(`${'name'.padEnd(w)}  retries  timeout  schedule`)
    for (const r of rows)
      console.log(
        `${r.name.padEnd(w)}  ${String(r.retries).padEnd(7)}  ${String(r.timeout).padEnd(7)}  ${r.schedule}`,
      )
  },
}

export const work = {
  meta: {
    name: 'jobs:work',
    description:
      'Run the job worker in this process (for `worker: false` setups). Boots the app from server/main.ts and drains the queue until stopped.',
  },
  args: {
    entry: {
      type: 'string',
      description: 'The server entry that exports `app`. Default server/main.ts',
      default: 'server/main.ts',
    },
  },
  async run({ args }: { args: { entry: string } }) {
    const root = process.cwd()
    const file = resolve(root, args.entry)
    if (!existsSync(file)) throw new Error(`${args.entry} not found`)
    const { createJiti } = await import('jiti')
    const jiti = createJiti(file, { interopDefault: true, alias: aliases(root) })
    const mod = (await jiti.import(file)) as { app?: { boot(): Promise<unknown>; container: any } }
    if (!mod.app) throw new Error(`${args.entry} does not export \`app\``)
    await mod.app.boot()
    const jobs = mod.app.container.use('jobs') as { start(): void; stop(): Promise<void> }
    jobs.start()
    console.log('jobs worker running (ctrl-c to stop)')
    await new Promise<void>((done) => {
      const stop = () => {
        jobs.stop().then(done, done)
      }
      process.once('SIGINT', stop)
      process.once('SIGTERM', stop)
    })
  },
}

export default { 'jobs:list': list, 'jobs:work': work }
