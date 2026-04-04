import { ipcMain } from 'electron'
import { createServer, type Server } from 'http'
import { networkInterfaces } from 'os'
import { getPrisma } from '../db/prisma'
import { getStore } from '../store/store'
import {
  atualizarLeilaoLocal,
  criarLeilaoLocal,
  listarLeiloesLocal,
  obterLeilaoLocal,
  removerLeilaoLocal
} from './leiloes'
import {
  atualizarAnimalLocal,
  atualizarAnimaisEmLoteLocal,
  criarAnimalLocal,
  listarAnimaisPorLeilaoLocal,
  removerAnimalLocal,
  removerAnimaisPorLeilaoLocal
} from './animais'
import { tbsService } from '../services/tbs.service'
import { isRemate360Url, remate360Service } from '../services/remate360.service'
import type { ApiImportProvider } from './apiImport'

type ModoOperacao = 'HOST' | 'REMOTO' | null

type LeilaoPayload = {
  id: string
  titulo_evento: string
  data: string
  condicoes_de_pagamento: string
  usa_dolar: boolean
  cotacao: number | null
  multiplicador: number
  total_animais: number
  criado_em: string
  atualizado_em: string
}

type AnimalPayload = {
  id: string
  leilao_id: string
  lote: string
  nome: string
  categoria: string
  vendedor: string
  condicoes_pagamento_especificas: string
  raca: string
  sexo: string
  pelagem: string
  nascimento: string
  informacoes: string
  genealogia: string
  condicoes_cobertura: string[]
  criado_em: string
  atualizado_em: string
}

type OperacaoEstadoPayload = {
  leilao: LeilaoPayload | null
  animal: AnimalPayload | null
  layout_modo: 'AGREGADAS' | 'SEPARADAS'
  lance_digitado: string
  lance_atual: string
  lance_atual_centavos: number
  lance_dolar: string
  total_real: string
  total_dolar: string
  atualizado_em: string
}

type OperacaoEstadoPersistido = {
  animalId: string | null
  lanceDigitado: string
  layoutModo: 'AGREGADAS' | 'SEPARADAS'
  lanceAtual: string
  lanceAtualCentavos: number
  lanceDolar: string
  totalReal: string
  totalDolar: string
}

type OperacaoConexaoInfo = {
  modo: ModoOperacao
  hostIp: string
  porta: number
  baseUrl: string
  ipsDisponiveis: string[]
}

let operacaoServer: Server | null = null
let operacaoServerPort = 18452
const operacaoSseClientes = new Map<string, Set<import('http').ServerResponse>>()
const syncSseClientes = new Map<string, Set<import('http').ServerResponse>>()

function getAppModeOverride(): ModoOperacao {
  if (__APP_MODE__ === 'HOST' || __APP_MODE__ === 'REMOTO') {
    return __APP_MODE__
  }

  return null
}

function getLocalIps() {
  const nets = networkInterfaces()
  const ips = new Set<string>()
  let zeroTierIp = ''

  for (const nome of Object.keys(nets)) {
    for (const net of nets[nome] ?? []) {
      if (net.family !== 'IPv4' || net.internal) continue
      ips.add(net.address)

      if (!zeroTierIp && /^zt/i.test(nome)) {
        zeroTierIp = net.address
      }
    }
  }

  if (ips.size === 0) {
    return {
      primary: '127.0.0.1',
      all: ['127.0.0.1']
    }
  }

  const all = Array.from(ips)
  return {
    primary: zeroTierIp || all[0],
    all: zeroTierIp ? [zeroTierIp, ...all.filter((ip) => ip !== zeroTierIp)] : all
  }
}

function buildUrls(leilaoId: string) {
  const ips = getLocalIps()
  const path = `/operacao/${encodeURIComponent(leilaoId)}.json`

  return {
    url_http: `http://${ips.primary}:${operacaoServerPort}${path}`,
    urls_http: ips.all.map((ip) => `http://${ip}:${operacaoServerPort}${path}`)
  }
}

export async function getModoConexaoOperacao(): Promise<OperacaoConexaoInfo> {
  const store = await getStore()
  const modo = getAppModeOverride() ?? store.get('modo')
  const conexao = store.get('conexaoApp')
  const ips = getLocalIps()
  const hostIp =
    modo === 'HOST'
      ? ips.primary
      : String(conexao?.hostIp ?? '').trim() || '127.0.0.1'

  return {
    modo,
    hostIp,
    porta: operacaoServerPort,
    baseUrl: `http://${hostIp}:${operacaoServerPort}`,
    ipsDisponiveis: modo === 'HOST' ? ips.all : [hostIp]
  }
}

export async function isHostOperacao() {
  const store = await getStore()
  return (getAppModeOverride() ?? store.get('modo')) === 'HOST'
}

function getOperacaoSseClientes(leilaoId: string) {
  let clientes = operacaoSseClientes.get(leilaoId)
  if (!clientes) {
    clientes = new Set()
    operacaoSseClientes.set(leilaoId, clientes)
  }
  return clientes
}

function getSyncSseClientes(canal: string) {
  let clientes = syncSseClientes.get(canal)
  if (!clientes) {
    clientes = new Set()
    syncSseClientes.set(canal, clientes)
  }
  return clientes
}

export function publicarSyncEvento(canal: string, payload: unknown = { at: Date.now() }) {
  const clientes = syncSseClientes.get(canal)
  if (!clientes || clientes.size === 0) return

  const data = `data: ${JSON.stringify(payload)}\n\n`

  for (const cliente of clientes) {
    if (!cliente.writableEnded) {
      cliente.write(data)
    }
  }
}

async function obterLayoutAnimaisLocal(leilaoId: string) {
  const store = await getStore()
  const layouts = store.get('layoutAnimaisPorLeilao')
  return (
    layouts?.[leilaoId] ?? {
      modo: 'AGREGADAS',
      incluirRacaNasImportacoes: false
    }
  )
}

async function salvarLayoutAnimaisLocal(
  leilaoId: string,
  layout: { modo: 'AGREGADAS' | 'SEPARADAS'; incluirRacaNasImportacoes: boolean }
) {
  const store = await getStore()
  const layouts = store.get('layoutAnimaisPorLeilao')
  store.set('layoutAnimaisPorLeilao', {
    ...layouts,
    [leilaoId]: layout
  })
  return layout
}

function responderJson(
  res: import('http').ServerResponse,
  status: number,
  body: unknown
) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  })
  res.end(JSON.stringify(body))
}

async function lerCorpoJson(req: import('http').IncomingMessage) {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const raw = Buffer.concat(chunks).toString('utf-8').trim()
  return raw ? JSON.parse(raw) : null
}

function normalizarEstadoPersistido(
  estado?: Partial<OperacaoEstadoPersistido> | null
): OperacaoEstadoPersistido {
  return {
    animalId: estado?.animalId ?? null,
    lanceDigitado: String(estado?.lanceDigitado ?? ''),
    layoutModo: estado?.layoutModo === 'SEPARADAS' ? 'SEPARADAS' : 'AGREGADAS',
    lanceAtual: String(estado?.lanceAtual ?? '0,00'),
    lanceAtualCentavos: Number(estado?.lanceAtualCentavos ?? 0) || 0,
    lanceDolar: String(estado?.lanceDolar ?? '0,00'),
    totalReal: String(estado?.totalReal ?? '0,00'),
    totalDolar: String(estado?.totalDolar ?? '0,00')
  }
}

async function obterEstadoPersistidoLocal(leilaoId: string): Promise<OperacaoEstadoPersistido | null> {
  const store = await getStore()
  const estado = (store.get('operacaoPorLeilao')?.[leilaoId] ?? null) as OperacaoEstadoPersistido | null
  return estado ? normalizarEstadoPersistido(estado) : null
}

async function persistirEstadoOperacaoLocal(leilaoId: string, payload: OperacaoEstadoPayload) {
  const store = await getStore()
  const operacaoPorLeilao = store.get('operacaoPorLeilao') ?? {}

  const proximoEstado = normalizarEstadoPersistido({
    animalId: payload.animal?.id ?? null,
    lanceDigitado: payload.lance_digitado ?? '',
    layoutModo: payload.layout_modo,
    lanceAtual: payload.lance_atual ?? '0,00',
    lanceAtualCentavos: payload.lance_atual_centavos ?? 0,
    lanceDolar: payload.lance_dolar ?? '0,00',
    totalReal: payload.total_real ?? '0,00',
    totalDolar: payload.total_dolar ?? '0,00'
  })

  store.set('operacaoPorLeilao', {
    ...operacaoPorLeilao,
    [leilaoId]: proximoEstado
  })

  return proximoEstado
}

function publicarEstadoOperacao(leilaoId: string, estado: OperacaoEstadoPersistido | null) {
  const clientes = operacaoSseClientes.get(leilaoId)
  if (!clientes || clientes.size === 0) return

  const payload = `data: ${JSON.stringify(estado)}\n\n`

  for (const cliente of clientes) {
    if (!cliente.writableEnded) {
      cliente.write(payload)
    }
  }
}

export async function fetchRemotoJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)

  if (!response.ok) {
    throw new Error(`Falha na comunicação com o host (${response.status}).`)
  }

  return (await response.json()) as T
}

function parseInformacoesAgregadas(informacoes: string) {
  const partes = String(informacoes ?? '')
    .split('|')
    .map((parte) => parte.trim())
    .filter(Boolean)

  if (partes.length >= 4) {
    const [raca, sexo, pelagem, ...resto] = partes
    return { raca, sexo, pelagem, nascimento: resto.join(' | ').trim() }
  }

  if (partes.length === 3) {
    const [sexo, pelagem, nascimento] = partes
    return { raca: '', sexo, pelagem, nascimento }
  }

  if (partes.length === 2) {
    const [sexo, pelagem] = partes
    return { raca: '', sexo, pelagem, nascimento: '' }
  }

  if (partes.length === 1) {
    return { raca: '', sexo: partes[0], pelagem: '', nascimento: '' }
  }

  return { raca: '', sexo: '', pelagem: '', nascimento: '' }
}

function serializarAnimal(animal: any): AnimalPayload | null {
  if (!animal) return null

  let condicoesCobertura: string[] = []
  try {
    const parsed = JSON.parse(animal.condicoes_cobertura ?? '[]')
    condicoesCobertura = Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    condicoesCobertura = []
  }

  return {
    ...animal,
    vendedor: animal.proprietario ?? '',
    condicoes_pagamento_especificas: animal.condicoes_pagamento_especificas ?? '',
    raca: animal.raca ?? '',
    sexo: animal.sexo ?? '',
    pelagem: animal.pelagem ?? '',
    nascimento: animal.nascimento ?? '',
    condicoes_cobertura: condicoesCobertura,
    criado_em: animal.criado_em instanceof Date ? animal.criado_em.toISOString() : animal.criado_em,
    atualizado_em:
      animal.atualizado_em instanceof Date ? animal.atualizado_em.toISOString() : animal.atualizado_em
  }
}

async function montarJsonOperacao(leilaoId: string) {
  const prisma = await getPrisma()
  const estado = await obterEstadoPersistidoLocal(leilaoId)

  const leilao = await prisma.leilao.findUnique({
    where: { id: leilaoId }
  })

  const animalRow =
    estado?.animalId
      ? (
          await prisma.$queryRawUnsafe<any[]>(
            `
              SELECT
                id,
                leilao_id,
                lote,
                nome,
                categoria,
                proprietario,
                condicoes_pagamento_especificas,
                raca,
                sexo,
                pelagem,
                nascimento,
                informacoes,
                genealogia,
                condicoes_cobertura,
                criado_em,
                atualizado_em
              FROM Animal
              WHERE id = ?
              LIMIT 1
            `,
            estado.animalId
          )
        )[0] ?? null
      : null

  const animal = serializarAnimal(animalRow)
  const condicoes =
    String(animal?.condicoes_pagamento_especificas ?? '').trim() ||
    String(leilao?.condicoes_de_pagamento ?? '').trim()
  const parsed = parseInformacoesAgregadas(animal?.informacoes ?? '')

  return [
    {
      CONDICOES: condicoes,
      LOTE: animal?.lote ?? '',
      NOME: animal?.nome ?? '',
      INFORMACOES: animal?.informacoes ?? '',
      RACA: animal?.raca || parsed.raca || '',
      SEXO: animal?.sexo || parsed.sexo || '',
      PELAGEM: animal?.pelagem || parsed.pelagem || '',
      NASCIMENTO: animal?.nascimento || parsed.nascimento || '',
      GENEALOGIA: animal?.genealogia ?? '',
      VENDEDOR: animal?.vendedor ?? '',
      PACOTES_COBERTURAS:
        animal?.categoria === 'COBERTURAS' ? animal.condicoes_cobertura.join('\n') : '',
      LANCE: estado?.lanceAtual ?? '0,00',
      LANCE_DOLAR: estado?.lanceDolar ?? '0,00',
      TOTAL_REAL: estado?.totalReal ?? '0,00',
      TOTAL_DOLAR: estado?.totalDolar ?? '0,00'
    }
  ]
}

export async function ensureOperacaoServer() {
  if (!(await isHostOperacao())) {
    return { porta: operacaoServerPort }
  }

  if (operacaoServer) {
    return { porta: operacaoServerPort }
  }

  operacaoServer = createServer(async (req, res) => {
    const url = req.url ?? ''
    const match = url.match(/^\/operacao\/([^/]+)\.json$/)
    const matchEstado = url.match(/^\/operacao\/estado\/([^/]+)$/)
    const matchSync = url.match(/^\/operacao\/sync\/([^/]+)$/)
    const matchEvents = url.match(/^\/operacao\/events\/([^/]+)$/)
    const matchSyncEvents = url.match(/^\/sync\/events\/(.+)$/)
    const matchLeiloes = url.match(/^\/sync\/leiloes$/)
    const matchLeilao = url.match(/^\/sync\/leiloes\/([^/]+)$/)
    const matchAnimais = url.match(/^\/sync\/animais\/([^/]+)$/)
    const matchAnimaisLote = url.match(/^\/sync\/animais-lote$/)
    const matchAnimal = url.match(/^\/sync\/animal\/([^/]+)$/)
    const matchAnimaisLimpar = url.match(/^\/sync\/animais-leilao\/([^/]+)$/)
    const matchLayout = url.match(/^\/sync\/layout\/([^/]+)$/)
    const matchConfigApiProviders = url.match(/^\/sync\/config\/api-providers$/)
    const matchTbsLeiloes = url.match(/^\/sync\/tbs\/leiloes$/)
    const matchTbsImportar = url.match(/^\/sync\/tbs\/importar$/)
    const matchRemateEventos = url.match(/^\/sync\/remate360\/eventos$/)
    const matchRemateImportar = url.match(/^\/sync\/remate360\/importar$/)
    const matchApiLeiloes = url.match(/^\/sync\/importacao\/api\/leiloes$/)
    const matchApiImportar = url.match(/^\/sync\/importacao\/api\/importar$/)

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      })
      res.end()
      return
    }

    try {
      if (match) {
        const leilaoId = decodeURIComponent(match[1] ?? '')
        const body = await montarJsonOperacao(leilaoId)
        responderJson(res, 200, body)
        return
      }

      if (matchEstado && req.method === 'GET') {
        const leilaoId = decodeURIComponent(matchEstado[1] ?? '')
        const body = await obterEstadoPersistidoLocal(leilaoId)
        responderJson(res, 200, body)
        return
      }

      if (matchSync && req.method === 'POST') {
        const leilaoId = decodeURIComponent(matchSync[1] ?? '')
        const payload = (await lerCorpoJson(req)) as OperacaoEstadoPayload
        const estado = await persistirEstadoOperacaoLocal(leilaoId, payload)
        publicarEstadoOperacao(leilaoId, estado)
        responderJson(res, 200, {
          estado,
          arquivo: buildUrls(leilaoId)
        })
        return
      }

      if (matchEvents && req.method === 'GET') {
        const leilaoId = decodeURIComponent(matchEvents[1] ?? '')

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        })

        const clientes = getOperacaoSseClientes(leilaoId)
        clientes.add(res)

        const estadoAtual = await obterEstadoPersistidoLocal(leilaoId)
        res.write(`data: ${JSON.stringify(estadoAtual)}\n\n`)

        const heartbeat = setInterval(() => {
          if (!res.writableEnded) {
            res.write(': ping\n\n')
          }
        }, 15000)

        req.on('close', () => {
          clearInterval(heartbeat)
          clientes.delete(res)
          if (clientes.size === 0) {
            operacaoSseClientes.delete(leilaoId)
          }
          if (!res.writableEnded) res.end()
        })

        return
      }

      if (matchSyncEvents && req.method === 'GET') {
        const canal = decodeURIComponent(matchSyncEvents[1] ?? '')

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        })

        const clientes = getSyncSseClientes(canal)
        clientes.add(res)
        res.write(`data: ${JSON.stringify({ ready: true, channel: canal, at: Date.now() })}\n\n`)

        const heartbeat = setInterval(() => {
          if (!res.writableEnded) {
            res.write(': ping\n\n')
          }
        }, 15000)

        req.on('close', () => {
          clearInterval(heartbeat)
          clientes.delete(res)
          if (clientes.size === 0) {
            syncSseClientes.delete(canal)
          }
          if (!res.writableEnded) res.end()
        })

        return
      }

      if (matchLeiloes && req.method === 'GET') {
        responderJson(res, 200, await listarLeiloesLocal())
        return
      }

      if (matchLeiloes && req.method === 'POST') {
        const payload = await lerCorpoJson(req)
        const created = await criarLeilaoLocal(payload)
        publicarSyncEvento('leiloes')
        responderJson(res, 200, created)
        return
      }

      if (matchLeilao && req.method === 'GET') {
        responderJson(res, 200, await obterLeilaoLocal(decodeURIComponent(matchLeilao[1] ?? '')))
        return
      }

      if (matchLeilao && req.method === 'PUT') {
        const id = decodeURIComponent(matchLeilao[1] ?? '')
        const payload = await lerCorpoJson(req)
        const updated = await atualizarLeilaoLocal(id, payload)
        publicarSyncEvento('leiloes')
        publicarSyncEvento(`animais:${id}`)
        responderJson(res, 200, updated)
        return
      }

      if (matchLeilao && req.method === 'DELETE') {
        const id = decodeURIComponent(matchLeilao[1] ?? '')
        const removed = await removerLeilaoLocal(id)
        publicarSyncEvento('leiloes')
        publicarSyncEvento(`animais:${id}`)
        responderJson(res, 200, removed)
        return
      }

      if (matchAnimais && req.method === 'GET') {
        const leilaoId = decodeURIComponent(matchAnimais[1] ?? '')
        responderJson(res, 200, await listarAnimaisPorLeilaoLocal(leilaoId))
        return
      }

      if (matchAnimais && req.method === 'POST') {
        const leilaoId = decodeURIComponent(matchAnimais[1] ?? '')
        const payload = await lerCorpoJson(req)
        const created = await criarAnimalLocal(payload)
        publicarSyncEvento('leiloes')
        publicarSyncEvento(`animais:${leilaoId}`)
        responderJson(res, 200, created)
        return
      }

      if (matchAnimaisLote && req.method === 'PUT') {
        const payload = await lerCorpoJson(req)
        const updated = await atualizarAnimaisEmLoteLocal(Array.isArray(payload) ? payload : [])
        const leilaoId = updated[0]?.leilao_id
        if (leilaoId) {
          publicarSyncEvento('leiloes')
          publicarSyncEvento(`animais:${leilaoId}`)
        }
        responderJson(res, 200, updated)
        return
      }

      if (matchAnimal && req.method === 'PUT') {
        const id = decodeURIComponent(matchAnimal[1] ?? '')
        const payload = await lerCorpoJson(req)
        const updated = await atualizarAnimalLocal(id, payload)
        publicarSyncEvento('leiloes')
        publicarSyncEvento(`animais:${updated.leilao_id}`)
        responderJson(res, 200, updated)
        return
      }

      if (matchAnimal && req.method === 'DELETE') {
        const id = decodeURIComponent(matchAnimal[1] ?? '')
        const prisma = await getPrisma()
        const [animal] = await prisma.$queryRawUnsafe<any[]>(
          `SELECT leilao_id FROM Animal WHERE id = ? LIMIT 1`,
          id
        )
        await removerAnimalLocal(id)
        publicarSyncEvento('leiloes')
        if (animal?.leilao_id) {
          publicarSyncEvento(`animais:${String(animal.leilao_id)}`)
        }
        responderJson(res, 200, true)
        return
      }

      if (matchAnimaisLimpar && req.method === 'DELETE') {
        const leilaoId = decodeURIComponent(matchAnimaisLimpar[1] ?? '')
        await removerAnimaisPorLeilaoLocal(leilaoId)
        publicarSyncEvento('leiloes')
        publicarSyncEvento(`animais:${leilaoId}`)
        responderJson(res, 200, true)
        return
      }

      if (matchLayout && req.method === 'GET') {
        const leilaoId = decodeURIComponent(matchLayout[1] ?? '')
        responderJson(res, 200, await obterLayoutAnimaisLocal(leilaoId))
        return
      }

      if (matchLayout && req.method === 'PUT') {
        const leilaoId = decodeURIComponent(matchLayout[1] ?? '')
        const payload = await lerCorpoJson(req)
        const layout = await salvarLayoutAnimaisLocal(leilaoId, payload)
        publicarSyncEvento(`animais:${leilaoId}`)
        responderJson(res, 200, layout)
        return
      }

      if (matchConfigApiProviders && req.method === 'GET') {
        const store = await getStore()
        responderJson(res, 200, store.get('apiImportProviders') ?? [])
        return
      }

      if (matchConfigApiProviders && req.method === 'PUT') {
        const payload = await lerCorpoJson(req)
        const store = await getStore()
        store.set('apiImportProviders', Array.isArray(payload) ? payload : [])
        responderJson(res, 200, { ok: true })
        return
      }

      if (matchTbsLeiloes && req.method === 'GET') {
        responderJson(res, 200, await tbsService.listActiveAuctions())
        return
      }

      if (matchTbsImportar && req.method === 'POST') {
        const payload = (await lerCorpoJson(req)) as {
          leilaoId: string
          auctionId: number
          incluirRacaNasInformacoes?: boolean
        }
        const resumo = await tbsService.importAuction(
          payload.leilaoId,
          payload.auctionId,
          Boolean(payload.incluirRacaNasInformacoes)
        )
        publicarSyncEvento('leiloes')
        publicarSyncEvento(`animais:${payload.leilaoId}`)
        responderJson(res, 200, resumo)
        return
      }

      if (matchRemateEventos && req.method === 'GET') {
        responderJson(res, 200, await remate360Service.listEvents())
        return
      }

      if (matchRemateImportar && req.method === 'POST') {
        const payload = (await lerCorpoJson(req)) as {
          leilaoId: string
          eventId: number
          incluirRacaNasInformacoes?: boolean
        }
        const resumo = await remate360Service.importEvent(
          payload.leilaoId,
          payload.eventId,
          Boolean(payload.incluirRacaNasInformacoes)
        )
        publicarSyncEvento('leiloes')
        publicarSyncEvento(`animais:${payload.leilaoId}`)
        responderJson(res, 200, resumo)
        return
      }

      if (matchApiLeiloes && req.method === 'POST') {
        const payload = (await lerCorpoJson(req)) as { provider: ApiImportProvider }
        const provider = payload.provider

        if (isRemate360Url(provider.url)) {
          responderJson(res, 200, await remate360Service.listEventsByUrl(provider.url))
          return
        }

        responderJson(res, 200, await tbsService.listActiveAuctionsByUrl(provider.url))
        return
      }

      if (matchApiImportar && req.method === 'POST') {
        const payload = (await lerCorpoJson(req)) as {
          leilaoId: string
          provider: ApiImportProvider
          auctionId: number
          incluirRacaNasInformacoes?: boolean
        }
        const resumo =
          isRemate360Url(payload.provider.url)
            ? await remate360Service.importEventByUrl(
                payload.leilaoId,
                payload.auctionId,
                Boolean(payload.incluirRacaNasInformacoes),
                payload.provider.url
              )
            : await tbsService.importAuctionByUrl(
                payload.leilaoId,
                payload.auctionId,
                Boolean(payload.incluirRacaNasInformacoes),
                payload.provider.url
              )
        publicarSyncEvento('leiloes')
        publicarSyncEvento(`animais:${payload.leilaoId}`)
        responderJson(res, 200, resumo)
        return
      }

      responderJson(res, 404, { error: 'Not found' })
    } catch (error) {
      responderJson(res, 500, { error: (error as Error).message })
    }
  })

  await new Promise<void>((resolve, reject) => {
    operacaoServer!
      .listen(operacaoServerPort, '0.0.0.0', () => resolve())
      .once('error', reject)
  })

  return { porta: operacaoServerPort }
}

export function registrarIpcOperacao() {
  void ensureOperacaoServer().catch(() => {
    // No modo remoto não há servidor local da operação.
  })

  ipcMain.handle('operacao:obterConexao', async () => {
    if (await isHostOperacao()) {
      await ensureOperacaoServer()
    }
    return getModoConexaoOperacao()
  })

  ipcMain.handle('operacao:obterArquivo', async (_evt, leilaoId: string) => {
    const conexao = await getModoConexaoOperacao()

    if (conexao.modo === 'REMOTO') {
      return {
        url_http: `${conexao.baseUrl}/operacao/${encodeURIComponent(leilaoId)}.json`,
        urls_http: [`${conexao.baseUrl}/operacao/${encodeURIComponent(leilaoId)}.json`]
      }
    }

    await ensureOperacaoServer()
    return buildUrls(leilaoId)
  })

  ipcMain.handle('operacao:obterEstado', async (_evt, leilaoId: string) => {
    const conexao = await getModoConexaoOperacao()

    if (conexao.modo === 'REMOTO') {
      return fetchRemotoJson<OperacaoEstadoPersistido | null>(
        `${conexao.baseUrl}/operacao/estado/${encodeURIComponent(leilaoId)}`
      )
    }

    await ensureOperacaoServer()
    return obterEstadoPersistidoLocal(leilaoId)
  })

  ipcMain.handle(
    'operacao:atualizarArquivo',
    async (_evt, leilaoId: string, payload: OperacaoEstadoPayload) => {
      const conexao = await getModoConexaoOperacao()

      if (conexao.modo === 'REMOTO') {
        const response = await fetchRemotoJson<{ estado: OperacaoEstadoPersistido | null; arquivo: ReturnType<typeof buildUrls> }>(
          `${conexao.baseUrl}/operacao/sync/${encodeURIComponent(leilaoId)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          }
        )

        return response.arquivo
      }

      await ensureOperacaoServer()
      const estado = await persistirEstadoOperacaoLocal(leilaoId, payload)
      publicarEstadoOperacao(leilaoId, estado)
      return buildUrls(leilaoId)
    }
  )
}
