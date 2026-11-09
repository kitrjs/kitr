import { definePackage } from '@kitr/core/package'

/** `kitr add db`: bind any ORM as `db` with connect/disconnect in the lifecycle. No ORM shipped. */
export default definePackage({
  name: 'db',
  requires: ['server'],
  add(ctx) {
    ctx.provider.add('@kitr/db')
    ctx.env.add({ DATABASE_URL: 'postgres://localhost:5432/app' }, 'Database')
    ctx.config(
      'db',
      `import { defineDb } from '@kitr/db'\n\n// Example with Drizzle + postgres.js: \`pnpm add drizzle-orm postgres\`\n// import { drizzle } from 'drizzle-orm/postgres-js'\n// import postgres from 'postgres'\n\nexport default defineDb({\n  connect: async () => {\n    // const client = postgres(process.env.DATABASE_URL!)\n    // return drizzle(client)\n    return {} as unknown\n  },\n  // disconnect: (db) => db.$client.end(),\n})\n`,
    )
    ctx.agents.add(
      'db',
      `- \`config/db.ts\` connects the ORM; controllers and actions read it with \`useDb<AppDb>(ctx.app)\` or \`ctx.app.container.use('db')\`. Migrations are the ORM's own tooling.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/db')
    ctx.agents.remove('db')
  },
  vite: { serverOnlyConfig: true, provider: { client: false } },
})
