import { contextBridge, ipcRenderer } from 'electron'
import { allowChannels, exposeIpc } from 'kitr/desktop/preload'
import { channels } from './ipc'

// Only the channels declared in ipc.ts (and kitr's own kitr:* channels) reach the renderer.
exposeIpc(contextBridge, ipcRenderer, { allow: allowChannels(channels) })
