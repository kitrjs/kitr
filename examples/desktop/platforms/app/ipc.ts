/**
 * The IPC contract shared by main, preload and the renderer. Add a command here and to
 * `channels`, implement it in main.ts, call it from the app with `ipc.invoke('...')`.
 */
export type Ipc = {
  'app.version': () => string
  'dialog.openFile': (filters?: Array<{ name: string; extensions: string[] }>) => string | null
}

/** Events pushed from main to the renderer. */
export type IpcPush = {
  'app.focus': (focused: boolean) => void
}

/** Every channel above, at run time: preload lets only these (and kitr:*) through. */
export const channels = {
  'app.version': true,
  'dialog.openFile': true,
  'app.focus': true,
} satisfies Record<keyof Ipc | keyof IpcPush, true>
