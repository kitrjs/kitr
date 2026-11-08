import { defineConfig } from 'kitr/notifications'

export default defineConfig({
  icon: '/icon-192.png',
  // Ask from a click (browsers block unprompted asks); true asks at boot instead.
  requestOnBoot: false,
})
