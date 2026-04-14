import { getPrisma } from '../db/prisma'
import { getStore } from '../store/store'
import { listarAnimaisPorLeilaoLocal } from '../ipc/animais'
import { listarLeiloesLocal } from '../ipc/leiloes'

type GcApiConfig = {
  baseUrl: string
  accessToken: string
  deviceName: string
  lastPulledAt: string | null
}

type GcApiSyncSummary = {
  pushed: number
  pulled: number
  created: number
  updated: number
  deleted: number
  skipped: number
  serverTime: string | null
}

type GcApiLeilaoSyncState = {
  status: 'success' | 'error'
  lastSyncedAt: string | null
  lastError: string | null
  updatedAt: string
}

type RemoteAnimal = {
  external_id: string
  lot: string
  name: string
  breed?: string | null
  sex?: string | null
  coat?: string | null
  birth_date?: string | null
  seller?: string | null
  height?: string | null
  weight?: string | null
  aggregated_info?: string | null
  genealogy?: string | null
  payment_terms_specific?: string | null
  source_updated_at: string
  deleted_at?: string | null
  updated_at?: string | null
}

type RemoteAuction = {
  external_id: string
  title: string
  auction_date?: string | null
  payment_terms?: string | null
  uses_dollar?: boolean | null
  exchange_rate?: number | null
  multiplier?: number | null
  source_updated_at: string
  deleted_at?: string | null
  updated_at?: string | null
  animals?: RemoteAnimal[]
}

function normalizarGcApiConfig(config?: Partial<GcApiConfig> | null): GcApiConfig {
  return {
    baseUrl: String(config?.baseUrl ?? '').trim().replace(/\/+$/, ''),
    accessToken: String(config?.accessToken ?? '').trim(),
    deviceName: String(config?.deviceName ?? 'gc-desktop').trim() || 'gc-desktop',
    lastPulledAt: config?.lastPulledAt ? String(config.lastPulledAt) : null
  }
}

function upper(value?: string | null) {
  return String(value ?? '').trim().toUpperCase()
}

function normalizarTextoOpcional(value?: string | null) {
  const texto = String(value ?? '').trim()
  return texto || null
}

function normalizarDataParaApi(value?: string | null) {
  const texto = String(value ?? '').trim()
  if (!texto) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto
  }

  const matchBr = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (matchBr) {
    const [, dia, mes, ano] = matchBr
    return `${ano}-${mes}-${dia}`
  }

  return null
}

function normalizarDataParaApp(value?: string | null) {
  const texto = String(value ?? '').trim().toUpperCase()
  const matchIso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!matchIso) return texto

  const [, ano, mes, dia] = matchIso
  return `${dia}/${mes}/${ano}`
}

function normalizarDateTimeParaApi(value?: string | null) {
  const texto = String(value ?? '').trim()
  if (!texto) return null

  const data = new Date(texto)
  if (Number.isNaN(data.getTime())) return null

  return data.toISOString()
}

function timestampMs(value?: string | Date | null) {
  if (!value) return null
  const data = value instanceof Date ? value : new Date(value)
  const ms = data.getTime()
  return Number.isNaN(ms) ? null : ms
}

async function atualizarStatusSyncLeilao(
  leilaoId: string,
  status: GcApiLeilaoSyncState['status'],
  lastError: string | null = null
) {
  const store = await getStore()
  const atual = store.get('gcApiLeiloesSync')
  const agora = new Date().toISOString()

  store.set('gcApiLeiloesSync', {
    ...atual,
    [leilaoId]: {
      status,
      lastSyncedAt: status === 'success' ? agora : atual[leilaoId]?.lastSyncedAt ?? null,
      lastError,
      updatedAt: agora
    }
  })
}

async function removerStatusSyncLeilao(leilaoId: string) {
  const store = await getStore()
  const atual = { ...store.get('gcApiLeiloesSync') }
  delete atual[leilaoId]
  store.set('gcApiLeiloesSync', atual)
}

async function normalizarNascimentosAnimaisLocais(leilaoId?: string) {
  const prisma = await getPrisma()
  const filtroLeilao = leilaoId ? 'AND leilao_id = ?' : ''
  const params = leilaoId ? [leilaoId] : []

  await prisma.$executeRawUnsafe(
    `
      UPDATE Animal
      SET nascimento = substr(nascimento, 9, 2) || '/' || substr(nascimento, 6, 2) || '/' || substr(nascimento, 1, 4)
      WHERE nascimento GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      ${filtroLeilao}
    `,
    ...params
  )
}

async function fetchGcApiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const store = await getStore()
  const config = normalizarGcApiConfig(store.get('gcApi'))

  if (!config.baseUrl) {
    throw new Error('Configure a URL da GC API antes de sincronizar.')
  }

  if (!config.accessToken) {
    throw new Error('Configure o token da GC API antes de sincronizar.')
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.accessToken}`,
      ...(init?.headers ?? {})
    }
  })

  if (!response.ok) {
    let mensagem = `Falha na GC API (${response.status}).`

    try {
      const payload = (await response.json()) as {
        message?: string
        errors?: Record<string, string[]>
      }
      if (payload?.errors && Object.keys(payload.errors).length > 0) {
        const detalhes = Object.entries(payload.errors)
          .map(([campo, erros]) => `${campo}: ${erros.join(', ')}`)
          .join(' | ')
        mensagem = detalhes || payload.message || mensagem
      } else if (payload?.message) {
        mensagem = payload.message
      }
    } catch {
      // ignore
    }

    throw new Error(mensagem)
  }

  return response.json() as Promise<T>
}

async function pushLeilaoLocal(
  leilao: Awaited<ReturnType<typeof listarLeiloesLocal>>[number],
  summary: GcApiSyncSummary
) {
  try {
    const animais = await listarAnimaisPorLeilaoLocal(leilao.id)

    await fetchGcApiJson('/api/v1/sync/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        auction: {
          external_id: leilao.id,
          title: leilao.titulo_evento,
          auction_date: normalizarDataParaApi(leilao.data),
          payment_terms: leilao.condicoes_de_pagamento,
          uses_dollar: leilao.usa_dolar,
          exchange_rate: leilao.cotacao,
          multiplier: leilao.multiplicador,
          status: 'active',
          source_updated_at: normalizarDateTimeParaApi(leilao.atualizado_em) ?? new Date().toISOString(),
          metadata: {
            origin: 'app-gc-electron'
          }
        },
        animals: animais.map((animal) => ({
          external_id: animal.id,
          lot: normalizarTextoOpcional(animal.lote) ?? '',
          name: normalizarTextoOpcional(animal.nome) ?? '',
          breed: normalizarTextoOpcional(animal.raca),
          sex: normalizarTextoOpcional(animal.sexo),
          coat: normalizarTextoOpcional(animal.pelagem),
          birth_date: normalizarDataParaApi(animal.nascimento),
          seller: normalizarTextoOpcional(animal.vendedor),
          height: normalizarTextoOpcional(animal.altura),
          weight: normalizarTextoOpcional(animal.peso),
          aggregated_info: normalizarTextoOpcional(animal.informacoes),
          genealogy: normalizarTextoOpcional(animal.genealogia),
          payment_terms_specific: normalizarTextoOpcional(animal.condicoes_pagamento_especificas),
          order_index: 0,
          source_updated_at: normalizarDateTimeParaApi(animal.atualizado_em) ?? new Date().toISOString()
        }))
      })
    })

    summary.pushed += 1
    await atualizarStatusSyncLeilao(leilao.id, 'success')
  } catch (error) {
    await atualizarStatusSyncLeilao(leilao.id, 'error', (error as Error).message)
    throw error
  }
}

async function upsertLeilaoRemoto(remote: RemoteAuction) {
  const prisma = await getPrisma()
  const existente = await prisma.leilao.findUnique({
    where: { id: remote.external_id },
    select: { id: true }
  })

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO Leilao (
        id,
        titulo_evento,
        data,
        condicoes_de_pagamento,
        usa_dolar,
        cotacao,
        multiplicador,
        criado_em,
        atualizado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        titulo_evento = excluded.titulo_evento,
        data = excluded.data,
        condicoes_de_pagamento = excluded.condicoes_de_pagamento,
        usa_dolar = excluded.usa_dolar,
        cotacao = excluded.cotacao,
        multiplicador = excluded.multiplicador,
        atualizado_em = excluded.atualizado_em
    `,
    remote.external_id,
    upper(remote.title),
    String(remote.auction_date ?? '').trim(),
    upper(remote.payment_terms),
    remote.uses_dollar ? 1 : 0,
    remote.exchange_rate ?? null,
    Number(remote.multiplier ?? 1),
    remote.updated_at ?? remote.source_updated_at,
    remote.updated_at ?? remote.source_updated_at
  )

  return existente ? 'updated' : 'created'
}

async function upsertAnimalRemoto(leilaoId: string, remote: RemoteAnimal) {
  const prisma = await getPrisma()
  const atualizadoRemoto = remote.updated_at ?? remote.source_updated_at
  const existente = await prisma.animal.findUnique({
    where: { id: remote.external_id },
    select: { id: true, atualizado_em: true }
  })

  if (existente) {
    const localMs = timestampMs(existente.atualizado_em)
    const remotoMs = timestampMs(atualizadoRemoto)

    if (localMs !== null && remotoMs !== null && localMs > remotoMs) {
      return 'skipped'
    }
  }

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO Animal (
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
        altura,
        peso,
        informacoes,
        genealogia,
        condicoes_cobertura,
        criado_em,
        atualizado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        leilao_id = excluded.leilao_id,
        lote = excluded.lote,
        nome = excluded.nome,
        proprietario = excluded.proprietario,
        condicoes_pagamento_especificas = excluded.condicoes_pagamento_especificas,
        raca = excluded.raca,
        sexo = excluded.sexo,
        pelagem = excluded.pelagem,
        nascimento = excluded.nascimento,
        altura = excluded.altura,
        peso = excluded.peso,
        informacoes = excluded.informacoes,
        genealogia = excluded.genealogia,
        atualizado_em = excluded.atualizado_em
    `,
    remote.external_id,
    leilaoId,
    upper(remote.lot),
    upper(remote.name),
    'ANIMAIS',
    upper(remote.seller),
    upper(remote.payment_terms_specific),
    upper(remote.breed),
    upper(remote.sex),
    upper(remote.coat),
    normalizarDataParaApp(remote.birth_date),
    upper(remote.height),
    upper(remote.weight),
    upper(remote.aggregated_info),
    upper(remote.genealogy),
    '[]',
    atualizadoRemoto,
    atualizadoRemoto
  )

  return existente ? 'updated' : 'created'
}

async function removerLeilaoRemoto(id: string) {
  const prisma = await getPrisma()
  const existente = await prisma.leilao.findUnique({ where: { id }, select: { id: true } })
  if (!existente) return false
  await prisma.leilao.delete({ where: { id } })
  return true
}

async function removerAnimalRemoto(id: string) {
  const prisma = await getPrisma()
  const existente = await prisma.animal.findUnique({ where: { id }, select: { id: true } })
  if (!existente) return false
  await prisma.animal.delete({ where: { id } })
  return true
}

async function pushLeiloesLocais(summary: GcApiSyncSummary) {
  const leiloes = await listarLeiloesLocal()

  for (const leilao of leiloes) {
    await pushLeilaoLocal(leilao, summary)
  }
}

async function pullLeiloesRemotos(summary: GcApiSyncSummary) {
  const store = await getStore()
  const config = normalizarGcApiConfig(store.get('gcApi'))
  const updatedSince = config.lastPulledAt ? `?updated_since=${encodeURIComponent(config.lastPulledAt)}` : ''
  const response = await fetchGcApiJson<{
    server_time: string | null
    data: RemoteAuction[]
  }>(`/api/v1/sync/pull${updatedSince}`)

  for (const remote of response.data ?? []) {
    summary.pulled += 1

    if (remote.deleted_at) {
      if (await removerLeilaoRemoto(remote.external_id)) {
        summary.deleted += 1
        await removerStatusSyncLeilao(remote.external_id)
      } else {
        summary.skipped += 1
      }
      continue
    }

    const status = await upsertLeilaoRemoto(remote)
    summary[status] += 1

    for (const animal of remote.animals ?? []) {
      if (animal.deleted_at) {
        if (await removerAnimalRemoto(animal.external_id)) {
          summary.deleted += 1
        } else {
          summary.skipped += 1
        }
        continue
      }

      const animalStatus = await upsertAnimalRemoto(remote.external_id, animal)
      summary[animalStatus] += 1
    }

    await atualizarStatusSyncLeilao(remote.external_id, 'success')
  }

  summary.serverTime = response.server_time ?? null
  store.set('gcApi', {
    ...config,
    lastPulledAt: response.server_time ?? config.lastPulledAt
  })
}

export async function sincronizarGcApiTudo(): Promise<GcApiSyncSummary> {
  const summary: GcApiSyncSummary = {
    pushed: 0,
    pulled: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    serverTime: null
  }

  await pushLeiloesLocais(summary)
  await pullLeiloesRemotos(summary)
  await normalizarNascimentosAnimaisLocais()

  return summary
}

export async function sincronizarGcApiLeilao(leilaoId: string): Promise<GcApiSyncSummary> {
  const summary: GcApiSyncSummary = {
    pushed: 0,
    pulled: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    serverTime: null
  }

  const leiloes = await listarLeiloesLocal()
  const leilao = leiloes.find((item) => item.id === leilaoId)

  if (!leilao) {
    throw new Error('Leilão não encontrado para sincronização.')
  }

  await pushLeilaoLocal(leilao, summary)
  await pullLeiloesRemotos(summary)
  await normalizarNascimentosAnimaisLocais(leilaoId)

  return summary
}
