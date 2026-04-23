import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { getModoConexaoOperacao } from './operacao'

type JanelaPreset = 'DESKTOP' | 'OPERACAO'
const janelasConferencia = new Map<string, BrowserWindow>()
const janelasOperacao = new Map<string, BrowserWindow>()
const janelasRemotas = new Map<string, BrowserWindow>()

function centralizarNaTela(win: BrowserWindow, parent?: BrowserWindow | null) {
  const bounds = win.getBounds()
  const pontoReferencia = parent
    ? {
        x: Math.round(parent.getBounds().x + parent.getBounds().width / 2),
        y: Math.round(parent.getBounds().y + parent.getBounds().height / 2)
      }
    : screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(pontoReferencia)
  const area = display.workArea
  const x = Math.round(area.x + (area.width - bounds.width) / 2)
  const y = Math.round(area.y + (area.height - bounds.height) / 2)
  win.setPosition(x, y)
}

function ajustarTamanhoAoDisplay(
  win: BrowserWindow,
  alvo: { width: number; height: number },
  minimo: { width: number; height: number }
) {
  const bounds = win.getBounds()
  const pontoReferencia = {
    x: Math.round(bounds.x + bounds.width / 2),
    y: Math.round(bounds.y + bounds.height / 2)
  }
  const display = screen.getDisplayNearestPoint(pontoReferencia)
  const area = display.workArea
  const margem = 32
  const larguraDisponivel = Math.max(minimo.width, area.width - margem)
  const alturaDisponivel = Math.max(minimo.height, area.height - margem)

  win.setMinimumSize(minimo.width, minimo.height)
  win.setSize(
    Math.min(alvo.width, larguraDisponivel),
    Math.min(alvo.height, alturaDisponivel),
    true
  )
}

async function carregarJanelaConferencia(win: BrowserWindow, leilaoId: string, animalId?: string) {
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

  await win.loadFile(join(__dirname, '../renderer/index.html'), {
    query: Object.fromEntries(query.entries())
  })
}

async function carregarJanelaOperacao(
  win: BrowserWindow,
  windowMode: 'operation-auction-editor' | 'operation-animal-editor' | 'operation-vmix-editor',
  queryParams: Record<string, string>
) {
  const conexao = await getModoConexaoOperacao()
  const query = new URLSearchParams({
    window: windowMode,
    baseUrl: conexao.baseUrl,
    ...queryParams
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?${query.toString()}`)
    return
  }

  await win.loadFile(join(__dirname, '../renderer/index.html'), {
    query: Object.fromEntries(query.entries())
  })
}

async function carregarJanelaRemota(
  win: BrowserWindow,
  windowMode: 'remote-auction-editor' | 'remote-animal-editor' | 'remote-animal-settings',
  queryParams: Record<string, string>
) {
  const conexao = await getModoConexaoOperacao()
  const query = new URLSearchParams({
    window: windowMode,
    baseUrl: conexao.baseUrl,
    ...queryParams
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?${query.toString()}`)
    return
  }

  await win.loadFile(join(__dirname, '../renderer/index.html'), {
    query: Object.fromEntries(query.entries())
  })
}

function aplicarPreset(win: BrowserWindow, preset: JanelaPreset) {
  if (preset === 'OPERACAO') {
    ajustarTamanhoAoDisplay(
      win,
      { width: 500, height: 720 },
      { width: 400, height: 400 }
    )
    centralizarNaTela(win)
    return
  }

  ajustarTamanhoAoDisplay(
    win,
    { width: 1100, height: 720 },
    { width: 1100, height: 720 }
  )
  centralizarNaTela(win)
}

function getPreloadPath() {
  return join(__dirname, '../preload/index.js')
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

    const existente = janelasConferencia.get(chave)
    if (existente && !existente.isDestroyed()) {
      await carregarJanelaConferencia(existente, leilaoId, animalId)
      existente.show()
      existente.focus()
      return
    }

    const win = new BrowserWindow({
      width: 920,
      height: 860,
      minWidth: 760,
      minHeight: 720,
      show: false,
      autoHideMenuBar: false,
      webPreferences: {
        preload: getPreloadPath(),
        sandbox: false
      }
    })

    win.on('ready-to-show', () => {
      centralizarNaTela(win, parent)
      win.show()
    })

    win.on('closed', () => {
      janelasConferencia.delete(chave)
    })

    janelasConferencia.set(chave, win)
    await carregarJanelaConferencia(win, leilaoId, animalId)
  })

  ipcMain.handle('janela:abrirEditorLeilaoOperacao', async (event, leilaoId: string) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const chave = `leilao:${leilaoId}`
    const existente = janelasOperacao.get(chave)

    if (existente && !existente.isDestroyed()) {
      await carregarJanelaOperacao(existente, 'operation-auction-editor', { leilaoId })
      existente.show()
      existente.focus()
      return
    }

    const win = new BrowserWindow({
      width: 800,
      height: 620,
      minWidth: 640,
      minHeight: 480,
      show: false,
      autoHideMenuBar: false,
      webPreferences: {
        preload: getPreloadPath(),
        sandbox: false
      }
    })

    win.on('ready-to-show', () => {
      centralizarNaTela(win, parent)
      win.show()
    })

    win.on('closed', () => {
      janelasOperacao.delete(chave)
    })

    janelasOperacao.set(chave, win)
    await carregarJanelaOperacao(win, 'operation-auction-editor', { leilaoId })
  })

  ipcMain.handle('janela:abrirEditorAnimalOperacao', async (event, leilaoId: string, animalId?: string) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const chave = `animal:${leilaoId}`
    const existente = janelasOperacao.get(chave)
    const queryParams: Record<string, string> = { leilaoId }
    if (animalId) queryParams.animalId = animalId

    if (existente && !existente.isDestroyed()) {
      await carregarJanelaOperacao(existente, 'operation-animal-editor', queryParams)
      existente.show()
      existente.focus()
      return
    }

    const win = new BrowserWindow({
      width: 800,
      height: 620,
      minWidth: 640,
      minHeight: 480,
      show: false,
      autoHideMenuBar: false,
      webPreferences: {
        preload: getPreloadPath(),
        sandbox: false
      }
    })

    win.on('ready-to-show', () => {
      centralizarNaTela(win, parent)
      win.show()
    })

    win.on('closed', () => {
      janelasOperacao.delete(chave)
    })

    janelasOperacao.set(chave, win)
    await carregarJanelaOperacao(win, 'operation-animal-editor', queryParams)
  })

  ipcMain.handle('janela:abrirConfiguracaoVmixOperacao', async (event, leilaoId: string) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const chave = `vmix:${leilaoId}`
    const existente = janelasOperacao.get(chave)

    if (existente && !existente.isDestroyed()) {
      await carregarJanelaOperacao(existente, 'operation-vmix-editor', { leilaoId })
      existente.show()
      existente.focus()
      return
    }

    const win = new BrowserWindow({
      width: 500,
      height: 620,
      minWidth: 420,
      minHeight: 480,
      show: false,
      autoHideMenuBar: false,
      webPreferences: {
        preload: getPreloadPath(),
        sandbox: false
      }
    })

    win.on('ready-to-show', () => {
      centralizarNaTela(win, parent)
      win.show()
    })

    win.on('closed', () => {
      janelasOperacao.delete(chave)
    })

    janelasOperacao.set(chave, win)
    await carregarJanelaOperacao(win, 'operation-vmix-editor', { leilaoId })
  })

  ipcMain.handle('janela:abrirEditorLeilaoRemoto', async (event, leilaoId: string) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const chave = `leilao:${leilaoId}`
    const existente = janelasRemotas.get(chave)

    if (existente && !existente.isDestroyed()) {
      await carregarJanelaRemota(existente, 'remote-auction-editor', { leilaoId })
      existente.show()
      existente.focus()
      return
    }

    const win = new BrowserWindow({
      width: 860,
      height: 720,
      minWidth: 700,
      minHeight: 560,
      show: false,
      autoHideMenuBar: false,
      webPreferences: {
        preload: getPreloadPath(),
        sandbox: false
      }
    })

    win.on('ready-to-show', () => {
      centralizarNaTela(win, parent)
      win.show()
    })

    win.on('closed', () => {
      janelasRemotas.delete(chave)
    })

    janelasRemotas.set(chave, win)
    await carregarJanelaRemota(win, 'remote-auction-editor', { leilaoId })
  })

  ipcMain.handle('janela:abrirEditorAnimalRemoto', async (event, leilaoId: string, animalId: string) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const chave = `animal:${leilaoId}`
    const existente = janelasRemotas.get(chave)

    if (existente && !existente.isDestroyed()) {
      await carregarJanelaRemota(existente, 'remote-animal-editor', { leilaoId, animalId })
      existente.show()
      existente.focus()
      return
    }

    const win = new BrowserWindow({
      width: 980,
      height: 860,
      minWidth: 780,
      minHeight: 680,
      show: false,
      autoHideMenuBar: false,
      webPreferences: {
        preload: getPreloadPath(),
        sandbox: false
      }
    })

    win.on('ready-to-show', () => {
      centralizarNaTela(win, parent)
      win.show()
    })

    win.on('closed', () => {
      janelasRemotas.delete(chave)
    })

    janelasRemotas.set(chave, win)
    await carregarJanelaRemota(win, 'remote-animal-editor', { leilaoId, animalId })
  })

  ipcMain.handle('janela:abrirConfiguracaoAnimaisRemoto', async (event, leilaoId: string) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const chave = `config:${leilaoId}`
    const existente = janelasRemotas.get(chave)

    if (existente && !existente.isDestroyed()) {
      await carregarJanelaRemota(existente, 'remote-animal-settings', { leilaoId })
      existente.show()
      existente.focus()
      return
    }

    const win = new BrowserWindow({
      width: 880,
      height: 760,
      minWidth: 720,
      minHeight: 560,
      show: false,
      autoHideMenuBar: false,
      webPreferences: {
        preload: getPreloadPath(),
        sandbox: false
      }
    })

    win.on('ready-to-show', () => {
      centralizarNaTela(win, parent)
      win.show()
    })

    win.on('closed', () => {
      janelasRemotas.delete(chave)
    })

    janelasRemotas.set(chave, win)
    await carregarJanelaRemota(win, 'remote-animal-settings', { leilaoId })
  })
}
