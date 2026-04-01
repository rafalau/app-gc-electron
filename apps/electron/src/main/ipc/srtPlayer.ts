import { BrowserWindow, ipcMain } from 'electron'
import {
  ensureSrtPlayerWindow,
  setSrtPlayerBounds,
  setSrtPlayerVisible,
  startSrtPlayer,
  stopSrtPlayback,
  stopSrtPlayer
} from '../services/srtPlayer.service'

export function registrarIpcSrtPlayer() {
  ipcMain.handle('srt-player:prepare', async () => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (!window) throw new Error('Janela principal não encontrada.')

    ensureSrtPlayerWindow(window)
    return { ok: true }
  })

  ipcMain.handle(
    'srt-player:setBounds',
    async (_evt, bounds: { x: number; y: number; width: number; height: number }) => {
      setSrtPlayerBounds(bounds)
      return { ok: true }
    }
  )

  ipcMain.handle('srt-player:setVisible', async (_evt, visible: boolean) => {
    setSrtPlayerVisible(Boolean(visible))
    return { ok: true }
  })

  ipcMain.handle(
    'srt-player:start',
    async (_evt, payload: { url: string; muted?: boolean; volume?: number }) => {
      startSrtPlayer(payload)
      return { ok: true }
    }
  )

  ipcMain.handle('srt-player:stop', async () => {
    stopSrtPlayback()
    return { ok: true }
  })

  ipcMain.handle('srt-player:shutdown', async () => {
    stopSrtPlayer()
    return { ok: true }
  })
}
