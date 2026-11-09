import { defineConfig, percentageFlagsProvider, staticFlagsProvider } from '@kitr/flags'
import { flags } from '../app/flags'

export default defineConfig({
  definitions: flags,
  // First provider with an answer wins.
  providers: [
    staticFlagsProvider({ 'support-chat': true }),
    // The salt picks who lands in the 30%: change it and a different group of users gets the redesign.
    percentageFlagsProvider({ 'new-dashboard': 30 }, 'dashboard-2026'),
  ],
})
