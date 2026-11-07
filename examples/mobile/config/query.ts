import { defineConfig } from 'kitr/query'

export default defineConfig({
  // Navigating back within 30s never refetches.
  staleTime: 30_000,
})
