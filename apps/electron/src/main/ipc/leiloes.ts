import { ipcMain } from 'electron'
import { getPrisma } from '../db/prisma'
import {
  ensureOperacaoServer,
  fetchRemotoJson,
  getModoConexaoOperacao,
  publicarSyncEvento
} from './operacao'

type LeilaoCriarPayload = {
  titulo_evento: string
  data: string
  condicoes_de_pagamento: string
  usa_dolar: boolean
  cotacao: number | null
  multiplicador: number
}

type LeilaoAtualizarPayload = Partial<LeilaoCriarPayload>

function upper(value?: string | null) {
  return String(value ?? '').trim().toUpperCase()
}

function normalizarPayloadCriar(payload: LeilaoCriarPayload): LeilaoCriarPayload {
  return {
    ...payload,
    titulo_evento: upper(payload.titulo_evento),
    condicoes_de_pagamento: upper(payload.condicoes_de_pagamento)
  }
}

function normalizarPayloadAtualizar(payload: LeilaoAtualizarPayload): LeilaoAtualizarPayload {
  return {
    ...payload,
    ...(payload.titulo_evento !== undefined ? { titulo_evento: upper(payload.titulo_evento) } : {}),
    ...(payload.condicoes_de_pagamento !== undefined
      ? { condicoes_de_pagamento: upper(payload.condicoes_de_pagamento) }
      : {})
  }
}

function serializar(leilao: any) {
  return {
    ...leilao,
    total_animais: leilao.total_animais ?? 0,
    criado_em: leilao.criado_em instanceof Date ? leilao.criado_em.toISOString() : leilao.criado_em,
    atualizado_em: leilao.atualizado_em instanceof Date ? leilao.atualizado_em.toISOString() : leilao.atualizado_em
  }
}

export async function listarLeiloesLocal() {
  const prisma = await getPrisma()
  const leiloes = await prisma.leilao.findMany({
    orderBy: [{ data: 'desc' }]
  })
  const contagens = await prisma.$queryRawUnsafe<Array<{ leilao_id: string; total: number }>>(
    `
      SELECT leilao_id, COUNT(*) as total
      FROM Animal
      GROUP BY leilao_id
    `
  )
  const contagensPorLeilao = new Map(contagens.map((item) => [item.leilao_id, Number(item.total)]))

  return leiloes.map((leilao) =>
    serializar({
      ...leilao,
      total_animais: contagensPorLeilao.get(leilao.id) ?? 0
    })
  )
}

export async function obterLeilaoLocal(id: string) {
  const prisma = await getPrisma()
  const leilao = await prisma.leilao.findUnique({
    where: { id }
  })

  if (!leilao) return null

  const contagem = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
    `
      SELECT COUNT(*) as total
      FROM Animal
      WHERE leilao_id = ?
    `,
    id
  )

  return serializar({
    ...leilao,
    total_animais: Number(contagem[0]?.total ?? 0)
  })
}

export async function criarLeilaoLocal(payload: LeilaoCriarPayload) {
  const prisma = await getPrisma()
  const payloadNormalizado = normalizarPayloadCriar(payload)
  const leilao = await prisma.leilao.create({
    data: {
      titulo_evento: payloadNormalizado.titulo_evento,
      data: payloadNormalizado.data,
      condicoes_de_pagamento: payloadNormalizado.condicoes_de_pagamento ?? '',
      usa_dolar: payloadNormalizado.usa_dolar ?? false,
      cotacao: payloadNormalizado.cotacao,
      multiplicador: payloadNormalizado.multiplicador
    }
  })
  return serializar(leilao)
}

export async function atualizarLeilaoLocal(id: string, payload: LeilaoAtualizarPayload) {
  const prisma = await getPrisma()
  const payloadNormalizado = normalizarPayloadAtualizar(payload)
  const leilao = await prisma.leilao.update({
    where: { id },
    data: {
      ...(payloadNormalizado.titulo_evento !== undefined
        ? { titulo_evento: payloadNormalizado.titulo_evento }
        : {}),
      ...(payloadNormalizado.data !== undefined ? { data: payloadNormalizado.data } : {}),
      ...(payloadNormalizado.condicoes_de_pagamento !== undefined
        ? { condicoes_de_pagamento: payloadNormalizado.condicoes_de_pagamento }
        : {}),
      ...(payloadNormalizado.usa_dolar !== undefined
        ? { usa_dolar: payloadNormalizado.usa_dolar }
        : {}),
      ...(payloadNormalizado.cotacao !== undefined ? { cotacao: payloadNormalizado.cotacao } : {}),
      ...(payloadNormalizado.multiplicador !== undefined
        ? { multiplicador: payloadNormalizado.multiplicador }
        : {}),
      atualizado_em: new Date()
    }
  })
  return serializar(leilao)
}

export async function removerLeilaoLocal(id: string) {
  const prisma = await getPrisma()
  await prisma.leilao.delete({ where: { id } })
  return true
}

export function registrarIpcLeiloes() {
  ipcMain.handle('leiloes:listar', async () => {
    const conexao = await getModoConexaoOperacao()
    if (conexao.modo === 'REMOTO') {
      return fetchRemotoJson(`${conexao.baseUrl}/sync/leiloes`)
    }
    await ensureOperacaoServer()
    return listarLeiloesLocal()
  })

  ipcMain.handle('leiloes:obter', async (_evt, id: string) => {
    const conexao = await getModoConexaoOperacao()
    if (conexao.modo === 'REMOTO') {
      return fetchRemotoJson(`${conexao.baseUrl}/sync/leiloes/${encodeURIComponent(id)}`)
    }
    await ensureOperacaoServer()
    return obterLeilaoLocal(id)
  })

  ipcMain.handle('leiloes:criar', async (_evt, payload: LeilaoCriarPayload) => {
    const conexao = await getModoConexaoOperacao()
    if (conexao.modo === 'REMOTO') {
      return fetchRemotoJson(`${conexao.baseUrl}/sync/leiloes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    }
    await ensureOperacaoServer()
    const created = await criarLeilaoLocal(payload)
    publicarSyncEvento('leiloes')
    return created
  })

  ipcMain.handle('leiloes:atualizar', async (_evt, id: string, payload: LeilaoAtualizarPayload) => {
    const conexao = await getModoConexaoOperacao()
    if (conexao.modo === 'REMOTO') {
      return fetchRemotoJson(`${conexao.baseUrl}/sync/leiloes/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    }
    await ensureOperacaoServer()
    const updated = await atualizarLeilaoLocal(id, payload)
    publicarSyncEvento('leiloes')
    publicarSyncEvento(`animais:${id}`)
    return updated
  })

  ipcMain.handle('leiloes:remover', async (_evt, id: string) => {
    const conexao = await getModoConexaoOperacao()
    if (conexao.modo === 'REMOTO') {
      return fetchRemotoJson(`${conexao.baseUrl}/sync/leiloes/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      })
    }
    await ensureOperacaoServer()
    const removed = await removerLeilaoLocal(id)
    publicarSyncEvento('leiloes')
    publicarSyncEvento(`animais:${id}`)
    return removed
  })
}
