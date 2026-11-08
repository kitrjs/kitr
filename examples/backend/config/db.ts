import { defineDb } from '@kitr/db'

// Example with Drizzle + postgres.js: `pnpm add drizzle-orm postgres`
// import { drizzle } from 'drizzle-orm/postgres-js'
// import postgres from 'postgres'

export default defineDb({
  connect: async () => {
    // const client = postgres(process.env.DATABASE_URL!)
    // return drizzle(client)
    return {} as unknown
  },
  // disconnect: (db) => db.$client.end(),
})
