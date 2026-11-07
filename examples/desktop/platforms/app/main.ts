import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron'
import { createIpcEmitter, createMainWindow, handleIpc, handleKitrIpc, registerAppScheme } from 'kitr/desktop/electron-main'
import type { Ipc, IpcPush } from './ipc'

const window = {"title":"Desktop","width":1200,"height":800}

registerAppScheme(protocol)

const push = createIpcEmitter<IpcPush>(() => BrowserWindow.getAllWindows()[0]?.webContents)

handleIpc<Ipc>(ipcMain, {
  'app.version': () => app.getVersion(),
  'dialog.openFile': async (_event, filters) => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  },
})

app.whenReady().then(async () => {
  handleKitrIpc(ipcMain, app)
  const win = await createMainWindow({ ...window, devtools: true })
  win.on('focus', () => push.emit('app.focus', true))
  win.on('blur', () => push.emit('app.focus', false))
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow(window)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
