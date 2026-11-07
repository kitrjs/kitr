import { defineKitrConfig } from 'kitr/app'

/** kitr.dev is a kitr app: Start for prerendering, state for the package-manager picker. */
export default defineKitrConfig({
  packages: ['@kitr/router', '@kitr/state'],
  providers: [],
  directories: {
    app: 'app',
    routes: 'app/routes',
    config: 'config',
    components: 'app/components',
  },
})
