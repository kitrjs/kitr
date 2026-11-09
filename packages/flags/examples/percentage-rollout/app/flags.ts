import { defineFlags } from '@kitr/flags'

/** Every flag with its default, so unknown flags are a type error. */
export const flags = defineFlags({
  'new-dashboard': { default: false, description: 'The redesigned dashboard' },
  'support-chat': { default: true, description: 'The chat widget' },
})
