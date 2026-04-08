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
  altura: string
  informacoes: string
  genealogia: string
  condicoes_cobertura: string[]
  criado_em: string
  atualizado_em: string
}

type OperacaoEstadoPayload = {
  leilao: LeilaoPayload | null
  animal: AnimalPayload | null
  selecao_modo: 'SIMPLES' | 'COMPOSTO'
  animais_selecionados_ids: string[]
  animal_atual_index: number
  intervalo_segundos: number
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
  selecaoModo: 'SIMPLES' | 'COMPOSTO'
  animaisSelecionadosIds: string[]
  animalAtualIndex: number
  intervaloSegundos: number
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

type VmixConfigPayload = {
  ativo: boolean
  ip: string
  porta: number
  inputSelecionado: {
    key: string
    number: string
    title: string
    type: string
  } | null
  srt: {
    ativo: boolean
    porta: number | null
  }
}

let operacaoServer: Server | null = null
let operacaoServerPort = 18452
const OPERACAO_JSON_PATH = '/operacao.json'
const operacaoSseClientes = new Map<string, Set<import('http').ServerResponse>>()
const syncSseClientes = new Map<string, Set<import('http').ServerResponse>>()
const HOST_DEFAULT_IP = '127.0.0.1'
const VMIX_DEFAULT_PORT = 8088
const SRT_DEFAULT_PORT = 9001

function getAppModeOverride(): ModoOperacao {
  if (__APP_MODE__ === 'HOST' || __APP_MODE__ === 'REMOTO') {
    return __APP_MODE__
  }

  return null
}

function normalizarConfigVmix(vmix?: Partial<VmixConfigPayload> | null): VmixConfigPayload {
  const porta = Number(vmix?.porta)
  const portaSrt = Number(vmix?.srt?.porta)

  return {
    ativo: Boolean(vmix?.ativo),
    ip: String(vmix?.ip ?? '').trim(),
    porta: Number.isInteger(porta) && porta > 0 ? porta : VMIX_DEFAULT_PORT,
    inputSelecionado: vmix?.inputSelecionado
      ? {
          key: String(vmix.inputSelecionado.key ?? '').trim(),
          number: String(vmix.inputSelecionado.number ?? '').trim(),
          title: String(vmix.inputSelecionado.title ?? '').trim(),
          type: String(vmix.inputSelecionado.type ?? '').trim()
        }
      : null,
    srt: {
      ativo: Boolean(vmix?.srt?.ativo),
      porta: Number.isInteger(portaSrt) && portaSrt > 0 ? portaSrt : SRT_DEFAULT_PORT
    }
  }
}

function aplicarDefaultsVmix(
  modo: ModoOperacao,
  hostIp: string,
  vmix: VmixConfigPayload
): VmixConfigPayload {
  if (modo === 'HOST') {
    return {
      ...vmix,
      ip: vmix.ip || hostIp || HOST_DEFAULT_IP
    }
  }

  if (modo === 'REMOTO') {
    return {
      ...vmix,
      ip: vmix.ip || hostIp
    }
  }

  return vmix
}

function extrairAtributosXml(bloco: string) {
  const atributos: Record<string, string> = {}

  for (const match of bloco.matchAll(/(\w+)="([^"]*)"/g)) {
    atributos[match[1]] = match[2]
  }

  return atributos
}

async function listarInputsVmix(config: Partial<VmixConfigPayload>) {
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

async function obterConfigVmixOperacao() {
  const store = await getStore()
  const modo = getAppModeOverride() ?? store.get('modo')
  const conexao = store.get('conexaoApp')
  const vmix = normalizarConfigVmix(store.get('vmix'))
  return aplicarDefaultsVmix(modo, String(conexao?.hostIp ?? '').trim(), vmix)
}

async function salvarConfigVmixOperacao(vmix: Partial<VmixConfigPayload>) {
  const store = await getStore()
  const modo = getAppModeOverride() ?? store.get('modo')
  const conexao = store.get('conexaoApp')
  const aplicado = aplicarDefaultsVmix(
    modo,
    String(conexao?.hostIp ?? '').trim(),
    normalizarConfigVmix(vmix)
  )
  store.set('vmix', aplicado)
  return aplicado
}

function isPrivateIpv4(address: string) {
  return (
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  )
}

function isZeroTierInterface(nome: string) {
  return /^zt/i.test(nome) || /zerotier/i.test(nome)
}

function isPreferredLanInterface(nome: string) {
  return /^(eth|en|eno|ens|enp|wlan|wifi|wl)/i.test(nome)
}

function getLocalIps() {
  const nets = networkInterfaces()
  const zeroTierIps = new Set<string>()
  const lanIpsPreferenciais = new Set<string>()
  const lanIpsSecundarios = new Set<string>()

  for (const [nome, interfaces] of Object.entries(nets)) {
    for (const net of interfaces ?? []) {
      if (net.family !== 'IPv4' || net.internal) continue

      if (isZeroTierInterface(nome)) {
        zeroTierIps.add(net.address)
        continue
      }

      if (!isPrivateIpv4(net.address)) continue

      if (isPreferredLanInterface(nome)) {
        lanIpsPreferenciais.add(net.address)
      } else {
        lanIpsSecundarios.add(net.address)
      }
    }
  }

  const lanIp = Array.from(lanIpsPreferenciais)[0] ?? Array.from(lanIpsSecundarios)[0] ?? ''
  const zeroTierIp = Array.from(zeroTierIps)[0] ?? ''
  const selecionados = [zeroTierIp, lanIp].filter(Boolean)
  const all = Array.from(new Set(selecionados))

  if (all.length === 0) {
    return {
      primary: '127.0.0.1',
      all: ['127.0.0.1']
    }
  }

  return {
    primary: zeroTierIp || lanIp || all[0],
    all
  }
}

async function getJsonHostIp() {
  const store = await getStore()
  const vmix = store.get('vmix')
  const conexao = store.get('conexaoApp')
  const ipVmix = String(vmix?.ip ?? '').trim()
  const configurado = String(conexao?.hostIp ?? '').trim()
  return ipVmix || configurado || getLocalIps().primary || '127.0.0.1'
}

async function buildUrls() {
  const hostIp = await getJsonHostIp()
  const url = `http://${hostIp}:${operacaoServerPort}${OPERACAO_JSON_PATH}`

  return {
    url_http: url,
    urls_http: [url]
  }
}

export async function getModoConexaoOperacao(): Promise<OperacaoConexaoInfo> {
  const store = await getStore()
  const modo = getAppModeOverride() ?? store.get('modo')
  const conexao = store.get('conexaoApp')
  const configurado = String(conexao?.hostIp ?? '').trim()
  const hostIp = configurado || getLocalIps().primary || '127.0.0.1'

  return {
    modo,
    hostIp,
    porta: operacaoServerPort,
    baseUrl: `http://${hostIp}:${operacaoServerPort}`,
    ipsDisponiveis: [hostIp]
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
  const animalAtualIndex = Number(estado?.animalAtualIndex ?? 0)
  const intervaloSegundos = Number(estado?.intervaloSegundos ?? 10)

  return {
    animalId: estado?.animalId ?? null,
    selecaoModo: estado?.selecaoModo === 'COMPOSTO' ? 'COMPOSTO' : 'SIMPLES',
    animaisSelecionadosIds: Array.from(
      new Set(
        (Array.isArray(estado?.animaisSelecionadosIds) ? estado?.animaisSelecionadosIds : [])
          .map((id) => String(id ?? '').trim())
          .filter(Boolean)
      )
    ),
    animalAtualIndex: Number.isInteger(animalAtualIndex) && animalAtualIndex >= 0 ? animalAtualIndex : 0,
    intervaloSegundos:
      Number.isInteger(intervaloSegundos) && intervaloSegundos > 0 ? intervaloSegundos : 10,
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
    selecaoModo: payload.selecao_modo,
    animaisSelecionadosIds: payload.animais_selecionados_ids ?? [],
    animalAtualIndex: payload.animal_atual_index ?? 0,
    intervaloSegundos: payload.intervalo_segundos ?? 10,
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
  store.set('operacaoLeilaoAtualId', leilaoId)

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
  const partesBrutas = String(informacoes ?? '')
    .split('|')
    .map((parte) => parte.trim())
  let altura = ''
  const partes = partesBrutas.filter(Boolean).filter((parte) => {
    const matchAltura = parte.match(/^ALTURA\s*:\s*(.+)$/i)
    if (matchAltura) {
      altura = matchAltura[1].trim()
      return false
    }

    return !/^(INFO|LOCAL|CIDADE(?:\/UF)?|UF)\s*:/i.test(parte)
  })

  if (partesBrutas.length >= 4 || (partesBrutas.length > 1 && partesBrutas.some((parte) => parte === ''))) {
    const [raca = '', sexo = '', pelagem = '', nascimento = '', alturaPosicional = ''] = partesBrutas
    return {
      raca,
      sexo,
      pelagem,
      nascimento,
      altura: altura || alturaPosicional.trim()
    }
  }

  if (partes.length >= 5) {
    const [raca, sexo, pelagem, nascimento, alturaPosicional] = partes
    return { raca, sexo, pelagem, nascimento, altura: altura || alturaPosicional }
  }

  if (partes.length === 4) {
    const [raca, sexo, pelagem, nascimento] = partes
    return { raca, sexo, pelagem, nascimento, altura }
  }

  if (partes.length === 3) {
    const [sexo, pelagem, nascimento] = partes
    return { raca: '', sexo, pelagem, nascimento, altura }
  }

  if (partes.length === 2) {
    const [sexo, pelagem] = partes
    return { raca: '', sexo, pelagem, nascimento: '', altura }
  }

  if (partes.length === 1) {
    return { raca: '', sexo: partes[0], pelagem: '', nascimento: '', altura }
  }

  return { raca: '', sexo: '', pelagem: '', nascimento: '', altura: '' }
}

function formatarInformacoesParaExibicao(informacoes: string) {
  return String(informacoes ?? '')
    .split('|')
    .map((parte) => parte.trim())
    .filter(Boolean)
    .join('   |   ')
}

function formatarGenealogiaParaExibicao(genealogia: string) {
  return String(genealogia ?? '')
    .replace(/\s+X\s+/g, '   X   ')
    .trim()
}

function serializarAnimal(animal: any): AnimalPayload | null {
  if (!animal) return null
  const parsedInformacoes = parseInformacoesAgregadas(animal.informacoes ?? '')

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
    altura: parsedInformacoes.altura,
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
  const animaisSelecionados =
    estado?.animaisSelecionadosIds?.length
      ? await prisma.animal.findMany({
          where: {
            id: {
              in: estado.animaisSelecionadosIds
            }
          },
          select: {
            id: true,
            lote: true,
            nome: true,
            ordem: true
          },
          orderBy: [{ ordem: 'asc' }, { lote: 'asc' }]
        })
      : []
  const condicoes =
    String(animal?.condicoes_pagamento_especificas ?? '').trim() ||
    String(leilao?.condicoes_de_pagamento ?? '').trim()
  const parsed = parseInformacoesAgregadas(animal?.informacoes ?? '')

  return [
    {
      CONDICOES: condicoes,
      LOTE: animal?.lote ?? '',
      NOME: animal?.nome ?? '',
      INFORMACOES: formatarInformacoesParaExibicao(animal?.informacoes ?? ''),
      RACA: animal?.raca || parsed.raca || '',
      SEXO: animal?.sexo || parsed.sexo || '',
      PELAGEM: animal?.pelagem || parsed.pelagem || '',
      NASCIMENTO: animal?.nascimento || parsed.nascimento || '',
      ALTURA: animal?.altura || parsed.altura || '',
      GENEALOGIA: formatarGenealogiaParaExibicao(animal?.genealogia ?? ''),
      VENDEDOR: animal?.vendedor ?? '',
      PACOTES_COBERTURAS:
        animal?.categoria === 'COBERTURAS' ? animal.condicoes_cobertura.join('\n') : '',
      MODO_SELECAO: estado?.selecaoModo ?? 'SIMPLES',
      INTERVALO_SEGUNDOS: estado?.intervaloSegundos ?? 10,
      ANIMAL_ATUAL_INDEX: estado?.animalAtualIndex ?? 0,
      LOTES_SELECIONADOS: animaisSelecionados.map((item) => item.lote).join(', '),
      LOTES_SELECIONADOS_IDS: animaisSelecionados.map((item) => item.id).join(','),
      LOTES_SELECIONADOS_NOMES: animaisSelecionados.map((item) => item.nome).join(' | '),
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
    const matchJsonFixo = url.match(/^\/operacao\.json$/)
    const match = url.match(/^\/operacao\/([^/]+)\.json$/)
    const matchEstado = url.match(/^\/operacao\/estado\/([^/]+)$/)
    const matchSync = url.match(/^\/operacao\/sync\/([^/]+)$/)
    const matchEvents = url.match(/^\/operacao\/events\/([^/]+)$/)
    const matchSyncEvents = url.match(/^\/sync\/events\/(.+)$/)
    const matchConexao = url.match(/^\/sync\/conexao$/)
    const matchLeiloes = url.match(/^\/sync\/leiloes$/)
    const matchLeilao = url.match(/^\/sync\/leiloes\/([^/]+)$/)
    const matchAnimais = url.match(/^\/sync\/animais\/([^/]+)$/)
    const matchAnimaisLote = url.match(/^\/sync\/animais-lote$/)
    const matchAnimal = url.match(/^\/sync\/animal\/([^/]+)$/)
    const matchAnimaisLimpar = url.match(/^\/sync\/animais-leilao\/([^/]+)$/)
    const matchLayout = url.match(/^\/sync\/layout\/([^/]+)$/)
    const matchConfigVmix = url.match(/^\/sync\/config\/vmix$/)
    const matchConfigVmixInputs = url.match(/^\/sync\/config\/vmix\/inputs$/)
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
      if (matchJsonFixo && req.method === 'GET') {
        const store = await getStore()
        const leilaoId = String(store.get('operacaoLeilaoAtualId') ?? '').trim()

        if (!leilaoId) {
          responderJson(res, 200, [])
          return
        }

        const body = await montarJsonOperacao(leilaoId)
        responderJson(res, 200, body)
        return
      }

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
          arquivo: await buildUrls()
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

      if (matchConexao && req.method === 'GET') {
        responderJson(res, 200, await getModoConexaoOperacao())
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

      if (matchConfigVmix && req.method === 'GET') {
        responderJson(res, 200, await obterConfigVmixOperacao())
        return
      }

      if (matchConfigVmix && req.method === 'PUT') {
        const payload = await lerCorpoJson(req)
        const config = await salvarConfigVmixOperacao(payload)
        publicarSyncEvento('config:vmix')
        responderJson(res, 200, config)
        return
      }

      if (matchConfigVmixInputs && req.method === 'POST') {
        const payload = await lerCorpoJson(req)
        responderJson(res, 200, await listarInputsVmix(payload))
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
    const store = await getStore()
    store.set('operacaoLeilaoAtualId', leilaoId)

    if (conexao.modo === 'REMOTO') {
      const url = `${conexao.baseUrl}${OPERACAO_JSON_PATH}`
      return {
        url_http: url,
        urls_http: [url]
      }
    }

    await ensureOperacaoServer()
    return buildUrls()
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
        const response = await fetchRemotoJson<{
          estado: OperacaoEstadoPersistido | null
          arquivo: Awaited<ReturnType<typeof buildUrls>>
        }>(
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
      return buildUrls()
    }
  )
}
