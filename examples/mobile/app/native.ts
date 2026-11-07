import { isNative, perPlatform, platform } from 'kitr/capacitor'

/** Platform-aware values in one place, so components never branch on user agents. */
export const native = {
  isNative: isNative(),
  platform: platform(),
  // Example: where files open. Web gets a download, native gets the share sheet.
  openFile: perPlatform({
    web: () => (url: string) => window.open(url, '_blank'),
    native: () => (url: string) => window.open(url, '_system'),
  }),
}
