import { definePackage } from '@kitr/core/package'

/** `kitr add native`: clipboard, share sheet, haptics, location, camera and fingerprint unlock, each with a web fallback. */
export default definePackage({
  name: 'native',
  requires: ['platform'],
  client: true,
  add(ctx) {
    // With the mobile platform the Capacitor driver needs its plugins; the web build never loads them.
    if (
      ctx.has('@capacitor/core') ||
      Object.values(ctx.rc.platforms).some((p) => p.factory === 'mobile')
    )
      ctx.deps.add(
        '@capacitor/clipboard',
        '@capacitor/share',
        '@capacitor/haptics',
        '@capacitor/geolocation',
      )
    ctx.provider.add('@kitr/native/provider')
    ctx.agents.add(
      'native',
      `- Clipboard, share, haptics, geolocation, camera and biometrics come from \`useNative()\` / \`useClipboard()\` / \`useShare()\` / \`useGeolocation()\` in \`kitr/native/react\`. Check \`.supported\` (or \`canShare\`) before showing a button; calling an unsupported capability rejects with \`UnsupportedError\`.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/native/provider')
    ctx.agents.remove('native')
  },
})
