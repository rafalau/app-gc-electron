import { ipcMain } from 'electron'
import { createServer, type Server } from 'http'
import { networkInterfaces } from 'os'
import { getPrisma } from '../db/prisma'
import { getStore } from '../store/store'

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
  layoutModo: 'AGREGADAS' | 'SEPARADAS'
  lanceAtual: string
  lanceAtualCentavos: number
  lanceDolar: string
  totalReal: string
  totalDolar: string
}

let operacaoServer: Server | null = null
let operacaoServerPort = 18452

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
  const store = await getStore()
  const estado = store.get('operacaoPorLeilao')?.[leilaoId] ?? null

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

async function ensureOperacaoServer() {
  if (operacaoServer) {
    return { porta: operacaoServerPort }
  }

  operacaoServer = createServer(async (req, res) => {
    const url = req.url ?? ''
    const match = url.match(/^\/operacao\/([^/]+)\.json$/)

    if (!match) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: 'Not found' }))
      return
    }

    try {
      const leilaoId = decodeURIComponent(match[1] ?? '')
      const body = await montarJsonOperacao(leilaoId)

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      })
      res.end(JSON.stringify(body, null, 2))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: (error as Error).message }))
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
  void ensureOperacaoServer()

  ipcMain.handle('operacao:obterArquivo', async (_evt, leilaoId: string) => {
    await ensureOperacaoServer()
    return buildUrls(leilaoId)
  })

  ipcMain.handle('operacao:obterEstado', async (_evt, leilaoId: string) => {
    const store = await getStore()
    const estado = (store.get('operacaoPorLeilao')?.[leilaoId] ?? null) as OperacaoEstadoPersistido | null
    return estado
  })

  ipcMain.handle(
    'operacao:atualizarArquivo',
    async (_evt, leilaoId: string, payload: OperacaoEstadoPayload) => {
      await ensureOperacaoServer()
      const store = await getStore()
      const operacaoPorLeilao = store.get('operacaoPorLeilao') ?? {}

      store.set('operacaoPorLeilao', {
        ...operacaoPorLeilao,
        [leilaoId]: {
          animalId: payload.animal?.id ?? null,
          layoutModo: payload.layout_modo,
          lanceAtual: payload.lance_atual ?? '0,00',
          lanceAtualCentavos: payload.lance_atual_centavos ?? 0,
          lanceDolar: payload.lance_dolar ?? '0,00',
          totalReal: payload.total_real ?? '0,00',
          totalDolar: payload.total_dolar ?? '0,00'
        }
      })

      return buildUrls(leilaoId)
    }
  )
}
