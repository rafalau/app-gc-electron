import { app, shell, BrowserWindow, ipcMain, dialog, Menu, type MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import defaultIcon from '../../resources/icon.png?asset'
import hostIcon from '../../resources/icon-host.png?asset'
import remotoIcon from '../../resources/icon-remoto.png?asset'
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
import { registrarIpcGcSync } from './ipc/gcSync'
import { migrateDeploy } from './db/migrate'
import { getStore } from './store/store'
import { stopSrtPlayer } from './services/srtPlayer.service'

function getRuntimeIdentity() {
  if (__APP_MODE__ === 'HOST') {
    return {
      appName: 'APP GC Vmix Host',
      appUserModelId: 'com.appgc.vmix.host',
      linuxWmClass: 'app-gc-vmix-host',
      desktopEntry: 'app-gc-vmix-host.desktop'
    }
  }

  if (__APP_MODE__ === 'REMOTO') {
    return {
      appName: 'APP GC Vmix Remoto',
      appUserModelId: 'com.appgc.vmix.remoto',
      linuxWmClass: 'app-gc-vmix-remoto',
      desktopEntry: 'app-gc-vmix-remoto.desktop'
    }
  }

  return {
    appName: app.getName(),
    appUserModelId: 'com.electron',
    linuxWmClass: 'app-gc-vmix',
    desktopEntry: 'app-gc-vmix-host.desktop'
  }
}

const runtimeIdentity = getRuntimeIdentity()
app.setName(runtimeIdentity.appName)
app.setPath('userData', join(app.getPath('appData'), runtimeIdentity.appName))

function getRuntimeIcon() {
  if (__APP_MODE__ === 'HOST') return hostIcon
  if (__APP_MODE__ === 'REMOTO') return remotoIcon
  return defaultIcon
}

if (process.platform === 'linux') {
  // Reduz ruído de logs internos do Chromium/Electron no terminal.
  app.commandLine.appendSwitch('disable-logging')
  app.commandLine.appendSwitch('log-level', '3')
  app.commandLine.appendSwitch('class', runtimeIdentity.linuxWmClass)
  process.env.CHROME_DESKTOP = runtimeIdentity.desktopEntry
}

function configurarMenuApp() {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Fechar janela', role: 'close' },
        { type: 'separator' },
        { label: 'Sair', role: 'quit' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Desfazer', role: 'undo' },
        { label: 'Refazer', role: 'redo' },
        { type: 'separator' },
        { label: 'Recortar', role: 'cut' },
        { label: 'Copiar', role: 'copy' },
        { label: 'Colar', role: 'paste' },
        { label: 'Selecionar tudo', role: 'selectAll' }
      ]
    },
    {
      label: 'Visualizar',
      submenu: [
        { label: 'Recarregar', role: 'reload' },
        { label: 'Forçar recarregamento', role: 'forceReload' },
        { type: 'separator' },
        { label: 'Aumentar zoom', role: 'zoomIn' },
        { label: 'Diminuir zoom', role: 'zoomOut' },
        { label: 'Zoom padrão', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Tela cheia', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Janela',
      submenu: [
        { label: 'Minimizar', role: 'minimize' },
        { label: 'Fechar', role: 'close' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    title: runtimeIdentity.appName,
    width: 1100,
    height: 720,
    show: is.dev,
    autoHideMenuBar: false,
    ...(process.platform === 'linux' ? { icon: getRuntimeIcon() } : {}),
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
      stopSrtPlayer()
      mainWindow.close()
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
    configurarMenuApp()

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
    registrarIpcGcSync()

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
