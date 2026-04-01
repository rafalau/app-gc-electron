import { app, BrowserWindow } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

type BoundsPayload = {
  x: number
  y: number
  width: number
  height: number
}

type StartPayload = {
  url: string
  muted?: boolean
  volume?: number
}

let playerProcess: ChildProcess | null = null
let parentBrowserWindow: BrowserWindow | null = null
let parentWindowId: string | null = null

type SupportedPlatform = 'linux' | 'win32'

function isSupportedPlatform(platform: NodeJS.Platform): platform is SupportedPlatform {
  return platform === 'linux' || platform === 'win32'
}

function getResourceRoot() {
  if (app.isPackaged) {
    return process.resourcesPath
  }

  return join(app.getAppPath(), 'resources')
}

function getHelperExecutableName() {
  if (process.platform === 'win32') return 'srt-player-win.exe'
  return 'srt-player-linux'
}

function getHelperPath() {
  if (!isSupportedPlatform(process.platform)) {
    throw new Error(`Player SRT não suportado em ${process.platform}.`)
  }

  const helperPath = join(getResourceRoot(), 'bin', getHelperExecutableName())

  if (!existsSync(helperPath)) {
    throw new Error(
      `Helper do player SRT não encontrado em ${helperPath}. Gere ou empacote o binário desta plataforma.`
    )
  }

  return helperPath
}

function getPlayerRuntimePath() {
  return join(getResourceRoot(), 'runtime', 'mpv', process.platform)
}

function getChildEnv() {
  const env = { ...process.env }
  const runtimePath = getPlayerRuntimePath()

  if (!existsSync(runtimePath)) return env

  const pathKey = process.platform === 'win32' ? 'Path' : 'PATH'
  const currentPath = env[pathKey] ?? ''
  env[pathKey] = currentPath ? `${runtimePath}${process.platform === 'win32' ? ';' : ':'}${currentPath}` : runtimePath

  return env
}

function getParentWindowHex(window: BrowserWindow) {
  const nativeHandle = window.getNativeWindowHandle()

  if (nativeHandle.length >= 8) {
    return nativeHandle.readBigUInt64LE(0).toString(16)
  }

  if (nativeHandle.length >= 4) {
    return BigInt(nativeHandle.readUInt32LE(0)).toString(16)
  }

  throw new Error('Handle nativo da janela inválido.')
}

function sendCommand(command: string) {
  if (!playerProcess || playerProcess.killed || !playerProcess.stdin) return
  playerProcess.stdin.write(`${command}\n`)
}

export function ensureSrtPlayerWindow(window: BrowserWindow) {
  if (!isSupportedPlatform(process.platform)) return

  const windowId = getParentWindowHex(window)

  if (playerProcess && !playerProcess.killed && parentWindowId === windowId) {
    parentBrowserWindow = window
    return
  }

  stopSrtPlayer()
  parentBrowserWindow = window
  parentWindowId = windowId

  const childProcess = spawn(getHelperPath(), [windowId], {
    stdio: ['pipe', 'ignore', 'pipe'],
    env: getChildEnv()
  })
  playerProcess = childProcess

  childProcess.stderr?.on('data', (chunk) => {
    const msg = String(chunk ?? '').trim()
    if (msg) console.error('[srt-player]', msg)
  })

  childProcess.once('exit', () => {
    playerProcess = null
    parentBrowserWindow = null
    parentWindowId = null
  })
}

export function setSrtPlayerBounds(bounds: BoundsPayload) {
  let nextBounds = bounds

  if (parentBrowserWindow) {
    const frameBounds = parentBrowserWindow.getBounds()
    const contentBounds = parentBrowserWindow.getContentBounds()
    const offsetX = contentBounds.x - frameBounds.x
    const offsetY = contentBounds.y - frameBounds.y

    nextBounds = {
      x: bounds.x + offsetX,
      y: bounds.y + offsetY,
      width: bounds.width,
      height: bounds.height
    }
  }

  sendCommand(
    `BOUNDS ${Math.round(nextBounds.x)} ${Math.round(nextBounds.y)} ${Math.round(nextBounds.width)} ${Math.round(nextBounds.height)}`
  )
}

export function setSrtPlayerVisible(visible: boolean) {
  sendCommand(`VISIBLE ${visible ? 1 : 0}`)
}

export function setSrtPlayerMuted(muted: boolean) {
  sendCommand(`MUTE ${muted ? 1 : 0}`)
}

export function startSrtPlayer(payload: StartPayload) {
  const volume = Math.max(0, Math.min(200, Math.round(payload.volume ?? 100)))
  sendCommand(`VOLUME ${volume}`)
  sendCommand(`MUTE ${payload.muted ? 1 : 0}`)
  sendCommand(`PLAY ${payload.url}`)
}

export function stopSrtPlayback() {
  sendCommand('STOP')
}

export function stopSrtPlayer() {
  if (!playerProcess || playerProcess.killed) return

  sendCommand('QUIT')
  playerProcess.kill('SIGTERM')
  playerProcess = null
  parentBrowserWindow = null
  parentWindowId = null
}
