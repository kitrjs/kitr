import { defineCommands } from '@kitr/tauri/client'

/** Mirrors the `#[tauri::command]` functions in platforms/app/src-tauri/src/lib.rs. */
export type Commands = {
  greet: (args: { name: string }) => string
}

/** `await commands.greet({ name })`: typed. Guard with `isTauri()` for web builds. */
export const commands = defineCommands<Commands>()
