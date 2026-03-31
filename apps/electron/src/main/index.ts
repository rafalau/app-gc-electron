import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registrarIpcLeiloes } from './ipc/leiloes'
import { registrarIpcConfig } from './ipc/config'
import { registrarIpcAnimais } from './ipc/animais'
import { registrarIpcImportacoes } from './ipc/importacoes'
import { registrarIpcTbs } from './ipc/tbs'
import { registrarIpcRemate360 } from './ipc/remate360'
import { registrarIpcStudbook } from './ipc/studbook'
import { registrarIpcOperacao } from './ipc/operacao'
import { registrarIpcJanela } from './ipc/janela'
import { migrateDeploy } from './db/migrate'

if (process.platform === 'linux') {
  // Reduz ruído de logs internos do Chromium/Electron no terminal.
  app.commandLine.appendSwitch('disable-logging')
  app.commandLine.appendSwitch('log-level', '3')
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    show: false,
    autoHideMenuBar: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app
  .whenReady()
  .then(async () => {
    electronApp.setAppUserModelId('com.electron')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // IPC test
    ipcMain.on('ping', () => console.log('pong'))

    // Aplicar migrations no banco do usuário (profissional)
    await migrateDeploy()

    // Registrar IPCs uma única vez (não dentro da janela)
    registrarIpcConfig()
    registrarIpcLeiloes()
    registrarIpcAnimais()
    registrarIpcImportacoes()
    registrarIpcTbs()
    registrarIpcRemate360()
    registrarIpcStudbook()
    registrarIpcOperacao()
    registrarIpcJanela()

    createWindow()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  .catch((error) => {
    console.error('Falha ao iniciar a aplicação:', error)
    app.quit()
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
