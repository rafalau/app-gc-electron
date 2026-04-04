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
  if (!app.isPackaged) {
    return join(app.getAppPath(), 'resources')
  }

  const candidates = [
    join(process.resourcesPath, 'app.asar.unpacked', 'resources'),
    join(process.resourcesPath, 'resources'),
    process.resourcesPath
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return candidates[0]
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

  if (process.platform === 'win32' && nativeHandle.length >= 4) {
    return BigInt(nativeHandle.readUInt32LE(0)).toString(16)
  }

  if (nativeHandle.length >= 4) {
    return BigInt(nativeHandle.readUInt32LE(0)).toString(16)
  }

  throw new Error('Handle nativo da janela inválido.')
}

function sendCommand(command: string) {
  if (!playerProcess || playerProcess.killed || !playerProcess.stdin) return
  console.error(`[srt-player] comando: ${command}`)
  playerProcess.stdin.write(`${command}\n`)
}

function getResolvedBounds(bounds: BoundsPayload) {
  if (!parentBrowserWindow) return bounds

  if (process.platform === 'win32') {
    return {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height)
    }
  }

  const frameBounds = parentBrowserWindow.getBounds()
  const contentBounds = parentBrowserWindow.getContentBounds()
  const offsetX = contentBounds.x - frameBounds.x
  const offsetY = contentBounds.y - frameBounds.y

  return {
    x: bounds.x + offsetX,
    y: bounds.y + offsetY,
    width: bounds.width,
    height: bounds.height
  }
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

  console.error(`[srt-player] helper: ${getHelperPath()}`)
  console.error(`[srt-player] runtime: ${getPlayerRuntimePath()}`)

  childProcess.stderr?.on('data', (chunk) => {
    const msg = String(chunk ?? '').trim()
    if (msg) console.error('[srt-player]', msg)
  })

  childProcess.once('exit', (code, signal) => {
    console.error(`[srt-player] helper finalizado code=${code ?? 'null'} signal=${signal ?? 'null'}`)
    playerProcess = null
    parentBrowserWindow = null
    parentWindowId = null
  })
}

export function setSrtPlayerBounds(bounds: BoundsPayload) {
  const nextBounds = getResolvedBounds(bounds)
  console.error(
    `[srt-player] bounds renderer=(${bounds.x}, ${bounds.y}, ${bounds.width}, ${bounds.height}) final=(${nextBounds.x}, ${nextBounds.y}, ${nextBounds.width}, ${nextBounds.height})`
  )
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
