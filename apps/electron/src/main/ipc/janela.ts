import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { getModoConexaoOperacao } from './operacao'

type JanelaPreset = 'DESKTOP' | 'OPERACAO'
const janelasEdicaoRapida = new Map<string, BrowserWindow>()

async function carregarJanelaEdicaoRapida(win: BrowserWindow, leilaoId: string, animalId?: string) {
  const conexao = await getModoConexaoOperacao()
  const query = new URLSearchParams({
    window: 'quick-edit',
    leilaoId,
    baseUrl: conexao.baseUrl
  })

  if (animalId) {
    query.set('animalId', animalId)
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?${query.toString()}`)
    return
  }

  await win.loadFile(join(__dirname, '../../renderer/index.html'), {
    query: Object.fromEntries(query.entries())
  })
}

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

  ipcMain.handle('janela:abrirEdicaoRapida', async (event, leilaoId: string, animalId?: string) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const chave = leilaoId

    const existente = janelasEdicaoRapida.get(chave)
    if (existente && !existente.isDestroyed()) {
      await carregarJanelaEdicaoRapida(existente, leilaoId, animalId)
      existente.show()
      existente.focus()
      return
    }

    const win = new BrowserWindow({
      width: 1500,
      height: 860,
      minWidth: 1100,
      minHeight: 720,
      show: false,
      autoHideMenuBar: false,
      parent: parent ?? undefined,
      webPreferences: {
        preload: join(__dirname, '../../preload/index.js'),
        sandbox: false
      }
    })

    win.on('ready-to-show', () => {
      win.show()
    })

    win.on('closed', () => {
      janelasEdicaoRapida.delete(chave)
    })

    janelasEdicaoRapida.set(chave, win)
    await carregarJanelaEdicaoRapida(win, leilaoId, animalId)
  })
}
