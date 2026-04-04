import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registrarIpcLeiloes } from './ipc/leiloes'
import { registrarIpcConfig } from './ipc/config'
import { registrarIpcAnimais } from './ipc/animais'
import { registrarIpcImportacoes } from './ipc/importacoes'
import { registrarIpcApiImport } from './ipc/apiImport'
import { registrarIpcTbs } from './ipc/tbs'
import { registrarIpcRemate360 } from './ipc/remate360'
import { registrarIpcStudbook } from './ipc/studbook'
import { registrarIpcOperacao } from './ipc/operacao'
import { registrarIpcJanela } from './ipc/janela'
import { registrarIpcSrtPlayer } from './ipc/srtPlayer'
import { migrateDeploy } from './db/migrate'
import { getStore } from './store/store'
import { setSrtPlayerVisible } from './services/srtPlayer.service'

function getRuntimeIdentity() {
  if (__APP_MODE__ === 'HOST') {
    return {
      appName: 'APP GC Vmix Host',
      appUserModelId: 'com.appgc.vmix.host'
    }
  }

  if (__APP_MODE__ === 'REMOTO') {
    return {
      appName: 'APP GC Vmix Remoto',
      appUserModelId: 'com.appgc.vmix.remoto'
    }
  }

  return {
    appName: app.getName(),
    appUserModelId: 'com.electron'
  }
}

const runtimeIdentity = getRuntimeIdentity()
app.setName(runtimeIdentity.appName)
app.setPath('userData', join(app.getPath('appData'), runtimeIdentity.appName))

if (process.platform === 'linux') {
  // Reduz ruído de logs internos do Chromium/Electron no terminal.
  app.commandLine.appendSwitch('disable-logging')
  app.commandLine.appendSwitch('log-level', '3')
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    show: is.dev,
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

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }
  })

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error('Falha ao carregar renderer:', { errorCode, errorDescription, validatedURL })
      if (!mainWindow.isVisible()) {
        mainWindow.show()
      }
    }
  )

  let closingConfirmed = false
  mainWindow.on('close', async (event) => {
    if (closingConfirmed) return

    event.preventDefault()
    setSrtPlayerVisible(false)

    const store = await getStore()
    const modo = store.get('modo')
    const detail =
      modo === 'HOST'
        ? 'Ao encerrar o programa, caso alguém esteja conectado, a conexão será perdida.'
        : 'Ao encerrar o programa, a conexão com o host será encerrada.'

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Cancelar', 'Encerrar'],
      defaultId: 1,
      cancelId: 0,
      title: 'Confirmar encerramento',
      message: 'Deseja realmente encerrar o aplicativo?',
      detail
    })

    if (result.response === 1) {
      closingConfirmed = true
      mainWindow.close()
    } else {
      setSrtPlayerVisible(true)
    }
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
    electronApp.setAppUserModelId(runtimeIdentity.appUserModelId)

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
    registrarIpcApiImport()
    registrarIpcTbs()
    registrarIpcRemate360()
    registrarIpcStudbook()
    registrarIpcOperacao()
    registrarIpcJanela()
    registrarIpcSrtPlayer()

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
