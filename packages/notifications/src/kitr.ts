import { definePackage } from '@kitr/core/package'

/** `kitr add notifications`: permission, local and scheduled notifications that open the right page when tapped. */
export default definePackage({
  name: 'notifications',
  requires: ['platform'],
  client: true,
  add(ctx) {
    ctx.provider.add('@kitr/notifications/provider')
    ctx.config(
      'notifications',
      `import { defineConfig } from '@kitr/notifications'\n\nexport default defineConfig({\n  icon: '/icon-192.png',\n  // Ask from a click (browsers block unprompted asks); true asks at boot instead.\n  requestOnBoot: false,\n})\n`,
    )
    ctx.agents.add(
      'notifications',
      `- \`useNotificationPermission()\` gives \`{ permission, request }\`; call \`request\` from a click. \`notifications.show({ title, url })\` / \`schedule({ ..., at })\` resolve to an id for \`cancel\`. Route taps once, near the router: \`useNotificationTap((tap) => tap.url && navigate({ to: tap.url }))\`.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/notifications/provider')
    ctx.agents.remove('notifications')
  },
})
