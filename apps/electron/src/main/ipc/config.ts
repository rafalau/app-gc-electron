import { app, ipcMain } from 'electron'
import {
  createServer as createHttpServer,
  type Server as HttpServer,
  type ServerResponse
} from 'node:http'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { hostname } from 'node:os'
import { join } from 'node:path'
import { getStore } from '../store/store'
import {
  ensureOperacaoServer,
  fetchRemotoJson,
  getModoConexaoOperacao,
  publicarSyncEvento
} from './operacao'

type VmixConfigIpc = {
  ativo: boolean
  ip: string
  porta: number
  inputSelecionado: {
    key: string
    number: string
    title: string
    type: string
  } | null
  inputSelecionadoCoberturas: {
    key: string
    number: string
    title: string
    type: string
  } | null
  srt: {
    ativo: boolean
    porta: number | null
    networkCachingMs: number | null
  }
}

type ModoConfigIpc = {
  modo: 'HOST' | 'REMOTO' | null
  hostIp: string
  portaApp: number
}

type ApiImportProviderConfigIpc = {
  id: string
  nome: string
  url: string
}

type GcApiConfigIpc = {
  baseUrl: string
  accessToken: string
  deviceName: string
  lastPulledAt: string | null
}

const HOST_DEFAULT_IP = '127.0.0.1'
const VMIX_DEFAULT_PORT = 8088
const SRT_DEFAULT_PORT = 9001
const SRT_DEFAULT_NETWORK_CACHING_MS = 200
const GC_API_DEFAULT_DEVICE_NAME = hostname().trim() || 'gc-desktop'

type SrtConfigIpc = VmixConfigIpc['srt']

function getAppModeOverride(): 'HOST' | 'REMOTO' | null {
  if (__APP_MODE__ === 'HOST' || __APP_MODE__ === 'REMOTO') {
    return __APP_MODE__
  }

  return null
}

function normalizarConfigSrt(srt?: Partial<SrtConfigIpc> | null): SrtConfigIpc {
  const portaSrt = Number(srt?.porta)
  const networkCachingMs = Number(srt?.networkCachingMs)

  return {
    ativo: Boolean(srt?.ativo),
    porta: Number.isInteger(portaSrt) && portaSrt > 0 ? portaSrt : SRT_DEFAULT_PORT,
    networkCachingMs:
      Number.isInteger(networkCachingMs) && networkCachingMs >= 0
        ? networkCachingMs
        : SRT_DEFAULT_NETWORK_CACHING_MS
  }
}

function normalizarConfigVmix(vmix?: Partial<VmixConfigIpc> | null): VmixConfigIpc {
  const porta = Number(vmix?.porta)
  const inputSelecionado = vmix?.inputSelecionado
    ? {
        key: String(vmix.inputSelecionado.key ?? '').trim(),
        number: String(vmix.inputSelecionado.number ?? '').trim(),
        title: String(vmix.inputSelecionado.title ?? '').trim(),
        type: String(vmix.inputSelecionado.type ?? '').trim()
      }
    : null
  const inputSelecionadoCoberturas = vmix?.inputSelecionadoCoberturas
    ? {
        key: String(vmix.inputSelecionadoCoberturas.key ?? '').trim(),
        number: String(vmix.inputSelecionadoCoberturas.number ?? '').trim(),
        title: String(vmix.inputSelecionadoCoberturas.title ?? '').trim(),
        type: String(vmix.inputSelecionadoCoberturas.type ?? '').trim()
      }
    : null

  return {
    ativo: Boolean(vmix?.ativo),
    ip: String(vmix?.ip ?? '').trim(),
    porta: Number.isInteger(porta) && porta > 0 ? porta : VMIX_DEFAULT_PORT,
    inputSelecionado,
    inputSelecionadoCoberturas,
    srt: normalizarConfigSrt(vmix?.srt)
  }
}

function normalizarModoConfig(
  config?: Partial<ModoConfigIpc> | null,
  fallback?: Partial<ModoConfigIpc> | null
): ModoConfigIpc {
  const portaBase = Number(config?.portaApp ?? fallback?.portaApp ?? 18452)

  return {
    modo: config?.modo ?? fallback?.modo ?? null,
    hostIp: String(config?.hostIp ?? fallback?.hostIp ?? '').trim(),
    portaApp: Number.isInteger(portaBase) && portaBase > 0 ? portaBase : 18452
  }
}

function normalizarApiImportProviderConfig(
  providers?: Partial<ApiImportProviderConfigIpc>[] | null
): ApiImportProviderConfigIpc[] {
  return (Array.isArray(providers) ? providers : [])
    .map((provider, index) => ({
      id: String(provider?.id ?? `api-${index + 1}`)
        .trim()
        .toLowerCase(),
      nome: String(provider?.nome ?? '').trim(),
      url: String(provider?.url ?? '').trim()
    }))
    .filter((provider) => provider.nome && provider.url)
}

function normalizarGcApiConfig(config?: Partial<GcApiConfigIpc> | null): GcApiConfigIpc {
  const baseUrl = String(config?.baseUrl ?? '').trim().replace(/\/+$/, '')
  const deviceName = String(config?.deviceName ?? '').trim()

  return {
    baseUrl,
    accessToken: String(config?.accessToken ?? '').trim(),
    deviceName:
      !deviceName || deviceName === 'gc-desktop' ? GC_API_DEFAULT_DEVICE_NAME : deviceName,
    lastPulledAt: config?.lastPulledAt ? String(config.lastPulledAt).trim() : null
  }
}

async function testarConfiguracaoGcApi(config: Partial<GcApiConfigIpc> | null) {
  const normalizado = normalizarGcApiConfig(config)

  if (!normalizado.baseUrl) {
    throw new Error('Informe a URL base da GC API.')
  }

  if (!normalizado.accessToken) {
    throw new Error('Informe o token de acesso da GC API.')
  }

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${normalizado.accessToken}`
  }

  const healthResponse = await fetch(`${normalizado.baseUrl}/api/v1/health`, { headers })

  if (!healthResponse.ok) {
    throw new Error(`Falha ao consultar GC API (${healthResponse.status}).`)
  }

  const meResponse = await fetch(`${normalizado.baseUrl}/api/v1/me`, { headers })

  if (!meResponse.ok) {
    throw new Error('Token da GC API inválido ou expirado.')
  }

  const payload = (await meResponse.json()) as {
    user?: { id: number | string; name: string; email: string }
  }

  return {
    ok: true,
    user: payload.user
  }
}

function aplicarDefaultsDeModo(
  modoConfig: ModoConfigIpc,
  vmix: VmixConfigIpc
): { modoConfig: ModoConfigIpc; vmix: VmixConfigIpc } {
  if (modoConfig.modo === 'HOST') {
    return {
      modoConfig: {
        ...modoConfig,
        hostIp: modoConfig.hostIp || HOST_DEFAULT_IP
      },
      vmix: {
        ...vmix,
        ip: vmix.ip || HOST_DEFAULT_IP
      }
    }
  }

  if (modoConfig.modo === 'REMOTO') {
    return {
      modoConfig,
      vmix: {
        ...vmix,
        ip: modoConfig.hostIp || vmix.ip
      }
    }
  }

  return { modoConfig, vmix }
}

function extrairAtributosXml(bloco: string) {
  const atributos: Record<string, string> = {}

  for (const match of bloco.matchAll(/(\w+)="([^"]*)"/g)) {
    atributos[match[1]] = match[2]
  }

  return atributos
}

function mensagemFfmpegIgnoravel(mensagem: string) {
  const texto = mensagem.toLowerCase()

  return (
    texto.includes('decode_slice_header error') ||
    texto.includes('no frame!') ||
    texto.startsWith('last message repeated') ||
    texto.includes('non-existing pps') ||
    texto.includes('non-existing sps') ||
    texto.includes('error while decoding') ||
    texto.includes('concealing') ||
    texto.includes('missing reference picture')
  )
}

type SrtPreviewStatus = {
  ativo: boolean
  url: string | null
  endpoint: string | null
  erro: string | null
}

let srtPreviewProcess: ChildProcess | null = null
let srtMonitorProcess: ChildProcess | null = null
let srtPreviewStatus: SrtPreviewStatus = {
  ativo: false,
  url: null,
  endpoint: null,
  erro: null
}
let srtPreviewConfigKey: string | null = null
let srtPreviewHttpServer: HttpServer | null = null
let srtPreviewHttpPort: number | null = null
let srtPreviewFrameAtual: Buffer | null = null
const srtPreviewClientes = new Set<ServerResponse>()

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

function getBundledExecutable(name: 'ffmpeg.exe') {
  const bundled = join(getResourceRoot(), 'runtime', 'ffmpeg', 'win32', name)
  return existsSync(bundled) ? bundled : name
}

function montarEndpointSrt(vmix: VmixConfigIpc) {
  return `srt://${vmix.ip}:${vmix.srt.porta}?timeout=5000000`
}

async function aguardarInicializacaoPreview(processo: ChildProcess, timeoutMs = 5000): Promise<void> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (processo.exitCode !== null) {
      throw new Error('O processo de preview SRT foi finalizado antes de iniciar.')
    }

    await new Promise((resolve) => setTimeout(resolve, 150))
  }
}

async function garantirServidorPreviewHttp(): Promise<number> {
  if (srtPreviewHttpServer && srtPreviewHttpPort) {
    return srtPreviewHttpPort
  }

  srtPreviewHttpServer = createHttpServer((req, res) => {
    if (req.url?.startsWith('/preview.mjpg')) {
      res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Connection: 'keep-alive'
      })

      srtPreviewClientes.add(res)

      if (srtPreviewFrameAtual) {
        res.write(
          `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${srtPreviewFrameAtual.length}\r\n\r\n`
        )
        res.write(srtPreviewFrameAtual)
        res.write('\r\n')
      }

      req.on('close', () => {
        srtPreviewClientes.delete(res)
        if (!res.writableEnded) res.end()
      })

      return
    }

    if (!req.url?.startsWith('/preview.jpg')) {
      res.statusCode = 404
      res.end('Not Found')
      return
    }

    if (!srtPreviewFrameAtual) {
      res.statusCode = 503
      res.end('Preview indisponivel')
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.end(srtPreviewFrameAtual)
  })

  const porta = await new Promise<number>((resolve, reject) => {
    srtPreviewHttpServer!.once('error', reject)
    srtPreviewHttpServer!.listen(0, '127.0.0.1', () => {
      const address = srtPreviewHttpServer!.address()

      if (!address || typeof address === 'string') {
        reject(new Error('Não foi possível iniciar o servidor HTTP do preview SRT.'))
        return
      }

      resolve(address.port)
    })
  })

  srtPreviewHttpPort = porta
  return porta
}

function pararPreviewSrt() {
  if (srtPreviewProcess && !srtPreviewProcess.killed) {
    srtPreviewProcess.kill('SIGTERM')
  }

  srtPreviewFrameAtual = null
  for (const cliente of srtPreviewClientes) {
    if (!cliente.writableEnded) cliente.end()
  }
  srtPreviewClientes.clear()
  srtPreviewProcess = null
  srtPreviewConfigKey = null
  srtPreviewStatus = {
    ativo: false,
    url: null,
    endpoint: null,
    erro: null
  }
}

function pararMonitorSrtExterno() {
  if (srtMonitorProcess && !srtMonitorProcess.killed) {
    srtMonitorProcess.kill('SIGTERM')
  }

  srtMonitorProcess = null
}

async function abrirMonitorSrtExterno(config: Partial<VmixConfigIpc>) {
  const vmix = normalizarConfigVmix(config)

  if (!vmix.srt.ativo) {
    throw new Error('O recurso SRT está desativado.')
  }

  if (!vmix.ip) {
    throw new Error('Informe o IP para o monitor SRT.')
  }

  if (!vmix.srt.porta || vmix.srt.porta <= 0 || vmix.srt.porta > 65535) {
    throw new Error('Informe uma porta SRT válida.')
  }

  pararMonitorSrtExterno()

  const endpoint = montarEndpointSrt(vmix)
  const args = [
    '--no-video-title-show',
    '--network-caching=300',
    '--live-caching=300',
    endpoint
  ]

  const processo = spawn('vlc', args, {
    detached: true,
    stdio: 'ignore'
  })

  processo.unref()
  srtMonitorProcess = processo

  processo.once('error', () => {
    srtMonitorProcess = null
  })

  processo.once('exit', () => {
    srtMonitorProcess = null
  })

  return { ok: true }
}

async function iniciarPreviewSrt(config: Partial<VmixConfigIpc>) {
  const vmix = normalizarConfigVmix(config)

  if (!vmix.srt.ativo) {
    throw new Error('O recurso SRT está desativado.')
  }

  if (!vmix.ip) {
    throw new Error('Informe o IP para o preview SRT.')
  }

  if (!vmix.srt.porta || vmix.srt.porta <= 0 || vmix.srt.porta > 65535) {
    throw new Error('Informe uma porta SRT válida.')
  }

  const endpoint = montarEndpointSrt(vmix)
  const configKey = `${endpoint}`

  if (srtPreviewProcess && srtPreviewConfigKey === configKey && srtPreviewStatus.url) {
    return srtPreviewStatus
  }

  pararPreviewSrt()

  const portaHttp = await garantirServidorPreviewHttp()
  const url = `http://127.0.0.1:${portaHttp}/preview.mjpg`

  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-fflags',
    '+discardcorrupt+genpts',
    '-err_detect',
    'ignore_err',
    '-analyzeduration',
    '2M',
    '-probesize',
    '2M',
    '-y',
    '-i',
    endpoint,
    '-an',
    '-vf',
    'fps=15,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black',
    '-q:v',
    '5',
    '-f',
    'image2pipe',
    '-vcodec',
    'mjpeg',
    'pipe:1'
  ]

  const ffmpeg = spawn(getBundledExecutable('ffmpeg.exe'), args, {
    stdio: ['ignore', 'pipe', 'pipe']
  })

  srtPreviewProcess = ffmpeg
  srtPreviewConfigKey = configKey
  srtPreviewStatus = {
    ativo: true,
    url,
    endpoint,
    erro: null
  }

  let bufferAcumulado = Buffer.alloc(0)

  ffmpeg.stdout?.on('data', (chunk: Buffer) => {
    bufferAcumulado = Buffer.concat([bufferAcumulado, chunk])

    while (true) {
      const inicio = bufferAcumulado.indexOf(Buffer.from([0xff, 0xd8]))
      if (inicio < 0) {
        bufferAcumulado = Buffer.alloc(0)
        return
      }

      const fim = bufferAcumulado.indexOf(Buffer.from([0xff, 0xd9]), inicio + 2)
      if (fim < 0) {
        if (inicio > 0) bufferAcumulado = bufferAcumulado.subarray(inicio)
        return
      }

      const frame = bufferAcumulado.subarray(inicio, fim + 2)
      bufferAcumulado = bufferAcumulado.subarray(fim + 2)
      srtPreviewFrameAtual = frame

      for (const cliente of srtPreviewClientes) {
        if (cliente.writableEnded || cliente.destroyed) {
          srtPreviewClientes.delete(cliente)
          continue
        }

        cliente.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`)
        cliente.write(frame)
        cliente.write('\r\n')
      }
    }
  })

  ffmpeg.stderr.on('data', (chunk) => {
    const mensagens = String(chunk ?? '')
      .split('\n')
      .map((linha) => linha.trim())
      .filter(Boolean)

    const mensagemFatal = mensagens.find((mensagem) => !mensagemFfmpegIgnoravel(mensagem))

    if (mensagemFatal) {
      srtPreviewStatus.erro = mensagemFatal
    }
  })

  ffmpeg.once('error', (error) => {
    srtPreviewStatus.erro = error.message
    srtPreviewStatus.ativo = false
  })

  ffmpeg.once('exit', (code, signal) => {
    const erroAtual = srtPreviewStatus.erro
    srtPreviewFrameAtual = null
    for (const cliente of srtPreviewClientes) {
      if (!cliente.writableEnded) cliente.end()
    }
    srtPreviewClientes.clear()
    srtPreviewProcess = null
    srtPreviewConfigKey = null
    srtPreviewStatus = {
      ativo: false,
      url: null,
      endpoint,
      erro:
        erroAtual ??
        (code === 0 || signal === 'SIGTERM'
          ? null
          : `Preview SRT finalizado inesperadamente (${signal ?? code ?? 'sem código'}).`)
    }
  })

  try {
    await aguardarInicializacaoPreview(ffmpeg)
  } catch (error) {
    const erroAtual = srtPreviewStatus.erro
    pararPreviewSrt()
    throw new Error(erroAtual || (error as Error).message)
  }

  return srtPreviewStatus
}

async function listarInputsVmix(config: Partial<VmixConfigIpc>) {
  const vmix = normalizarConfigVmix(config)

  if (!vmix.ativo) {
    throw new Error('Ative o recurso do vMix para buscar os inputs.')
  }

  if (!vmix.ip) {
    throw new Error('Informe o IP do vMix para buscar os inputs.')
  }

  const response = await fetch(`http://${vmix.ip}:${vmix.porta}/api`)

  if (!response.ok) {
    throw new Error(`Falha ao consultar vMix API (${response.status}).`)
  }

  const xml = await response.text()
  const inputsMatch = xml.match(/<inputs[^>]*>([\s\S]*?)<\/inputs>/i)

  if (!inputsMatch) return []

  const inputs: Array<{ number: string; title: string; type: string; key: string }> = []

  for (const match of inputsMatch[1].matchAll(/<input\b([^>]*)\/?>/gi)) {
    const attrs = extrairAtributosXml(match[1])

    inputs.push({
      number: String(attrs.number ?? ''),
      title: String(attrs.title ?? ''),
      type: String(attrs.type ?? ''),
      key: String(attrs.key ?? '')
    })
  }

  return inputs
}

async function acionarOverlayVmix(config: Partial<VmixConfigIpc>) {
  const vmix = normalizarConfigVmix(config)

  if (!vmix.ativo) {
    throw new Error('O recurso do vMix está desativado.')
  }

  if (!vmix.ip) {
    throw new Error('Informe o IP do vMix.')
  }

  if (!vmix.inputSelecionado?.title) {
    throw new Error('Selecione um input do vMix.')
  }

  const url = new URL(`http://${vmix.ip}:${vmix.porta}/api/`)
  url.searchParams.set('Function', 'OverlayInput1')
  url.searchParams.set('Input', vmix.inputSelecionado.title)

  const response = await fetch(url.toString())

  if (!response.ok) {
    throw new Error(`Falha ao acionar overlay do vMix (${response.status}).`)
  }

  return {
    ok: true
  }
}

export function registrarIpcConfig() {
  ipcMain.handle('config:setModo', async (_, config: Partial<ModoConfigIpc> | null) => {
    const store = await getStore()
    const modoFixo = getAppModeOverride()
    const modoAtual = store.get('modo')
    const conexaoAtual = store.get('conexaoApp')
    const vmixAtual = normalizarConfigVmix(store.get('vmix'))
    const modoConfig = normalizarModoConfig(config, {
      modo: modoFixo ?? modoAtual,
      hostIp: conexaoAtual.hostIp,
      portaApp: conexaoAtual.porta
    })
    modoConfig.modo = modoFixo ?? modoConfig.modo
    const aplicado = aplicarDefaultsDeModo(modoConfig, vmixAtual)

    store.set('modo', aplicado.modoConfig.modo)
    store.set('conexaoApp', {
      hostIp: aplicado.modoConfig.hostIp,
      porta: aplicado.modoConfig.portaApp
    })
    store.set('vmix', aplicado.vmix)

    if (aplicado.modoConfig.modo === 'REMOTO') {
      store.set('srtRemoto', normalizarConfigSrt(store.get('srtRemoto')))
    }
  })

  ipcMain.handle('config:getModo', async () => {
    const modoFixo = getAppModeOverride()
    if (modoFixo) return modoFixo
    const store = await getStore()
    return store.get('modo')
  })

  ipcMain.handle('config:getModoConfig', async () => {
    const store = await getStore()
    const modoFixo = getAppModeOverride()
    const modo = store.get('modo')
    const conexao = store.get('conexaoApp')

    return normalizarModoConfig({
      modo: modoFixo ?? modo,
      hostIp: conexao.hostIp,
      portaApp: conexao.porta
    })
  })

  ipcMain.handle('config:getVmix', async () => {
    const conexaoOperacao = await getModoConexaoOperacao()
    const store = await getStore()

    if (conexaoOperacao.modo === 'REMOTO') {
      const vmixLocal = normalizarConfigVmix(store.get('vmix'))
      const srtRemoto = normalizarConfigSrt(store.get('srtRemoto'))

      return {
        ...vmixLocal,
        ip: vmixLocal.ip || conexaoOperacao.hostIp,
        srt: srtRemoto
      }
    }

    const modoFixo = getAppModeOverride()
    const modo = store.get('modo')
    const conexao = store.get('conexaoApp')
    const vmix = normalizarConfigVmix(store.get('vmix'))

    return aplicarDefaultsDeModo(
      normalizarModoConfig({
        modo: modoFixo ?? modo,
        hostIp: conexao.hostIp,
        portaApp: conexao.porta
      }),
      vmix
    ).vmix
  })

  ipcMain.handle('config:setVmix', async (_evt, vmix: Partial<VmixConfigIpc>) => {
    const conexaoOperacao = await getModoConexaoOperacao()
    if (conexaoOperacao.modo === 'REMOTO') {
      const store = await getStore()
      const vmixLocalAtual = normalizarConfigVmix(store.get('vmix'))
      const srt = normalizarConfigSrt(vmix.srt)
      store.set('vmix', {
        ...vmixLocalAtual,
        ip: String(vmix.ip ?? '').trim() || conexaoOperacao.hostIp,
        porta: normalizarConfigVmix(vmix).porta,
        ativo: Boolean(vmix.ativo),
        inputSelecionado: normalizarConfigVmix(vmix).inputSelecionado,
        inputSelecionadoCoberturas: normalizarConfigVmix(vmix).inputSelecionadoCoberturas
      })
      store.set('srtRemoto', srt)
      return
    }

    const store = await getStore()
    const modoFixo = getAppModeOverride()
    const modo = store.get('modo')
    const conexao = store.get('conexaoApp')
    const aplicado = aplicarDefaultsDeModo(
      normalizarModoConfig({
        modo: modoFixo ?? modo,
        hostIp: conexao.hostIp,
        portaApp: conexao.porta
      }),
      normalizarConfigVmix(vmix)
    )
    store.set('vmix', aplicado.vmix)
    publicarSyncEvento('config:vmix')
  })

  ipcMain.handle('config:listarInputsVmix', async (_evt, vmix: Partial<VmixConfigIpc>) => {
    return listarInputsVmix(vmix)
  })

  ipcMain.handle('config:acionarOverlayVmix', async (_evt, vmix: Partial<VmixConfigIpc>) => {
    return acionarOverlayVmix(vmix)
  })

  ipcMain.handle('config:iniciarPreviewSrt', async (_evt, vmix: Partial<VmixConfigIpc>) => {
    return iniciarPreviewSrt(vmix)
  })

  ipcMain.handle('config:pararPreviewSrt', async () => {
    pararPreviewSrt()
    return srtPreviewStatus
  })

  ipcMain.handle('config:getStatusPreviewSrt', async () => {
    return srtPreviewStatus
  })

  ipcMain.handle('config:abrirMonitorSrtExterno', async (_evt, vmix: Partial<VmixConfigIpc>) => {
    return abrirMonitorSrtExterno(vmix)
  })

  ipcMain.handle('config:pararMonitorSrtExterno', async () => {
    pararMonitorSrtExterno()
    return { ok: true }
  })

  ipcMain.handle('config:getApiImportProviders', async () => {
    const conexao = await getModoConexaoOperacao()
    if (conexao.modo === 'REMOTO') {
      return fetchRemotoJson(`${conexao.baseUrl}/sync/config/api-providers`)
    }

    const store = await getStore()
    return normalizarApiImportProviderConfig(store.get('apiImportProviders'))
  })

  ipcMain.handle(
    'config:setApiImportProviders',
    async (_evt, providers: Partial<ApiImportProviderConfigIpc>[] | null) => {
      const providersNormalizados = normalizarApiImportProviderConfig(providers)
      const conexao = await getModoConexaoOperacao()
      if (conexao.modo === 'REMOTO') {
        await fetchRemotoJson(`${conexao.baseUrl}/sync/config/api-providers`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(providersNormalizados)
        })
        return
      }

      const store = await getStore()
      store.set('apiImportProviders', providersNormalizados)
    }
  )

  ipcMain.handle('config:getGcApi', async () => {
    const store = await getStore()
    return normalizarGcApiConfig(store.get('gcApi'))
  })

  ipcMain.handle('config:setGcApi', async (_evt, config: Partial<GcApiConfigIpc> | null) => {
    const store = await getStore()
    store.set('gcApi', normalizarGcApiConfig(config))
  })

  ipcMain.handle('config:testGcApi', async (_evt, config: Partial<GcApiConfigIpc> | null) => {
    return testarConfiguracaoGcApi(config)
  })

  ipcMain.handle('config:getLayoutAnimais', async (_evt, leilaoId: string) => {
    const conexao = await getModoConexaoOperacao()
    if (conexao.modo === 'REMOTO') {
      return fetchRemotoJson(`${conexao.baseUrl}/sync/layout/${encodeURIComponent(leilaoId)}`)
    }

    await ensureOperacaoServer()
    const store = await getStore()
    const layouts = store.get('layoutAnimaisPorLeilao')
    return (
      layouts?.[leilaoId] ?? {
        modo: 'AGREGADAS',
        incluirRacaNasImportacoes: false
      }
    )
  })

  ipcMain.handle(
    'config:setLayoutAnimais',
    async (
      _evt,
      leilaoId: string,
      layout: { modo: 'AGREGADAS' | 'SEPARADAS'; incluirRacaNasImportacoes: boolean }
    ) => {
      const conexao = await getModoConexaoOperacao()
      if (conexao.modo === 'REMOTO') {
        await fetchRemotoJson(`${conexao.baseUrl}/sync/layout/${encodeURIComponent(leilaoId)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(layout)
        })
        return
      }

      await ensureOperacaoServer()
      const store = await getStore()
      const layouts = store.get('layoutAnimaisPorLeilao')
      store.set('layoutAnimaisPorLeilao', {
        ...layouts,
        [leilaoId]: layout
      })
      publicarSyncEvento(`animais:${leilaoId}`)
    }
  )
}
