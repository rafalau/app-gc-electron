import { BrowserWindow, ipcMain } from 'electron'

type JanelaPreset = 'DESKTOP' | 'OPERACAO'

function aplicarPreset(win: BrowserWindow, preset: JanelaPreset) {
  if (preset === 'OPERACAO') {
    win.setMinimumSize(550, 720)
    win.setSize(550, Math.max(win.getSize()[1], 820), true)
    win.center()
    return
  }

  win.setMinimumSize(1100, 720)
  win.setSize(1100, 720, true)
  win.center()
}

export function registrarIpcJanela() {
  ipcMain.handle('janela:definirPreset', (event, preset: JanelaPreset) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    aplicarPreset(win, preset)
  })
}
