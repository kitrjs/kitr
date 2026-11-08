/**
 * The npm packages a device package's native driver loads, per platform type. `kitr add <package>`
 * installs the ones for the platforms the project has, so adding `notifications` to a Tauri app
 * also adds `@tauri-apps/plugin-notification`. Keys are the platform factory names in kitrrc.ts
 * (`desktop`, `tauri`, `mobile`). A new project gets the same packages from its platform
 * (`dependencies` of `desktop()` and `tauri()`).
 */
export const shellPeers: Record<string, Record<string, string[]>> = {
  'secure-storage': { tauri: ['@tauri-apps/api', '@tauri-apps/plugin-stronghold'] },
  notifications: { tauri: ['@tauri-apps/plugin-notification'] },
  files: {
    tauri: ['@tauri-apps/plugin-dialog', '@tauri-apps/plugin-fs', '@tauri-apps/plugin-opener'],
  },
  updater: {
    desktop: ['electron-updater'],
    tauri: ['@tauri-apps/api', '@tauri-apps/plugin-updater', '@tauri-apps/plugin-process'],
  },
  native: {
    tauri: [
      '@tauri-apps/api',
      '@tauri-apps/plugin-clipboard-manager',
      '@tauri-apps/plugin-os',
      '@tauri-apps/plugin-opener',
    ],
  },
}

/** The peers `name` needs on the given platform factories, without duplicates. */
export function peersFor(name: string, factories: Iterable<string>): string[] {
  const table = shellPeers[name] ?? {}
  return [...new Set([...factories].flatMap((factory) => table[factory] ?? []))]
}
