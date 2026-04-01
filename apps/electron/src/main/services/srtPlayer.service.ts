import { app, BrowserWindow } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
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

function getHelperPath() {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'bin', 'srt-player-linux')
  }

  return join(app.getAppPath(), 'resources/bin/srt-player-linux')
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
  if (process.platform !== 'linux') return

  const windowId = getParentWindowHex(window)

  if (playerProcess && !playerProcess.killed && parentWindowId === windowId) {
    parentBrowserWindow = window
    return
  }

  stopSrtPlayer()
  parentBrowserWindow = window
  parentWindowId = windowId

  const childProcess = spawn(getHelperPath(), [windowId], {
    stdio: ['pipe', 'ignore', 'pipe']
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
