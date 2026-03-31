import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getPrisma } from '../db/prisma'

type AnimalCriarPayload = {
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
}

type AnimalAtualizarPayload = Partial<Omit<AnimalCriarPayload, 'leilao_id'>>

function upper(value?: string | null) {
  return String(value ?? '').trim().toUpperCase()
}

function upperList(values?: string[] | null) {
  return Array.isArray(values) ? values.map((item) => upper(item)).filter(Boolean) : []
}

function normalizeVendedor(value?: string | null) {
  const texto = upper(value)
  if (!texto) return ''
  return texto.startsWith('VENDEDOR:') ? texto : `VENDEDOR: ${texto}`
}

function normalizarPayloadCriar(payload: AnimalCriarPayload): AnimalCriarPayload {
  return {
    ...payload,
    lote: upper(payload.lote),
    nome: upper(payload.nome),
    categoria: upper(payload.categoria || 'ANIMAIS'),
    vendedor: normalizeVendedor(payload.vendedor),
    condicoes_pagamento_especificas: upper(payload.condicoes_pagamento_especificas),
    raca: upper(payload.raca),
    sexo: upper(payload.sexo),
    pelagem: upper(payload.pelagem),
    nascimento: upper(payload.nascimento),
    informacoes: upper(payload.informacoes),
    genealogia: upper(payload.genealogia),
    condicoes_cobertura: upperList(payload.condicoes_cobertura)
  }
}

function normalizarPayloadAtualizar(payload: AnimalAtualizarPayload): AnimalAtualizarPayload {
  return {
    ...payload,
    ...(payload.lote !== undefined ? { lote: upper(payload.lote) } : {}),
    ...(payload.nome !== undefined ? { nome: upper(payload.nome) } : {}),
    ...(payload.categoria !== undefined ? { categoria: upper(payload.categoria) } : {}),
    ...(payload.vendedor !== undefined ? { vendedor: normalizeVendedor(payload.vendedor) } : {}),
    ...(payload.condicoes_pagamento_especificas !== undefined
      ? { condicoes_pagamento_especificas: upper(payload.condicoes_pagamento_especificas) }
      : {}),
    ...(payload.raca !== undefined ? { raca: upper(payload.raca) } : {}),
    ...(payload.sexo !== undefined ? { sexo: upper(payload.sexo) } : {}),
    ...(payload.pelagem !== undefined ? { pelagem: upper(payload.pelagem) } : {}),
    ...(payload.nascimento !== undefined ? { nascimento: upper(payload.nascimento) } : {}),
    ...(payload.informacoes !== undefined ? { informacoes: upper(payload.informacoes) } : {}),
    ...(payload.genealogia !== undefined ? { genealogia: upper(payload.genealogia) } : {}),
    ...(payload.condicoes_cobertura !== undefined
      ? { condicoes_cobertura: upperList(payload.condicoes_cobertura) }
      : {})
  }
}

function splitLote(lote: string) {
  return lote
    .trim()
    .toUpperCase()
    .match(/\d+|[^\d]+/g)
    ?.map((parte) => {
      const numerica = /^\d+$/.test(parte)
      return {
        valor: parte,
        numerica,
        numero: numerica ? BigInt(parte) : null
      }
    }) ?? [{ valor: lote.trim().toUpperCase(), numerica: false, numero: null }]
}

function compararLote(a: string, b: string) {
  const partesA = splitLote(a)
  const partesB = splitLote(b)
  const limite = Math.max(partesA.length, partesB.length)

  for (let i = 0; i < limite; i += 1) {
    const parteA = partesA[i]
    const parteB = partesB[i]

    if (!parteA) return -1
    if (!parteB) return 1

    if (parteA.numerica && parteB.numerica) {
      if (parteA.numero! < parteB.numero!) return -1
      if (parteA.numero! > parteB.numero!) return 1
      if (parteA.valor.length !== parteB.valor.length) return parteA.valor.length - parteB.valor.length
      continue
    }

    if (parteA.numerica !== parteB.numerica) {
      return parteA.numerica ? -1 : 1
    }

    const comparacao = parteA.valor.localeCompare(parteB.valor, 'pt-BR')
    if (comparacao !== 0) return comparacao
  }

  return a.localeCompare(b, 'pt-BR')
}

function serializar(animal: any) {
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

export function registrarIpcAnimais() {
  ipcMain.handle('animais:listarPorLeilao', async (_evt, leilaoId: string) => {
    const prisma = await getPrisma()
    const animais = await prisma.$queryRawUnsafe<any[]>(
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
        WHERE leilao_id = ?
        ORDER BY criado_em ASC
      `,
      leilaoId
    )
    animais.sort((a, b) => compararLote(a.lote, b.lote))
    return animais.map(serializar)
  })

  ipcMain.handle('animais:criar', async (_evt, payload: AnimalCriarPayload) => {
    const prisma = await getPrisma()
    const payloadNormalizado = normalizarPayloadCriar(payload)
    const id = randomUUID()
    const agora = new Date().toISOString()

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
          informacoes,
          genealogia,
          condicoes_cobertura,
          criado_em,
          atualizado_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      id,
      payloadNormalizado.leilao_id,
      payloadNormalizado.lote,
      payloadNormalizado.nome,
      payloadNormalizado.categoria ?? 'ANIMAIS',
      payloadNormalizado.vendedor ?? '',
      payloadNormalizado.condicoes_pagamento_especificas ?? '',
      payloadNormalizado.raca ?? '',
      payloadNormalizado.sexo ?? '',
      payloadNormalizado.pelagem ?? '',
      payloadNormalizado.nascimento ?? '',
      payloadNormalizado.informacoes ?? '',
      payloadNormalizado.genealogia ?? '',
      JSON.stringify(payloadNormalizado.condicoes_cobertura ?? []),
      agora,
      agora
    )

    const [animal] = await prisma.$queryRawUnsafe<any[]>(
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
      `,
      id
    )

    return serializar(animal)
  })

  ipcMain.handle('animais:atualizar', async (_evt, id: string, payload: AnimalAtualizarPayload) => {
    const prisma = await getPrisma()
    const payloadNormalizado = normalizarPayloadAtualizar(payload)
    const atual = new Date().toISOString()

    await prisma.$executeRawUnsafe(
      `
        UPDATE Animal
        SET
          lote = COALESCE(?, lote),
          nome = COALESCE(?, nome),
          categoria = COALESCE(?, categoria),
          proprietario = COALESCE(?, proprietario),
          condicoes_pagamento_especificas = COALESCE(?, condicoes_pagamento_especificas),
          raca = COALESCE(?, raca),
          sexo = COALESCE(?, sexo),
          pelagem = COALESCE(?, pelagem),
          nascimento = COALESCE(?, nascimento),
          informacoes = COALESCE(?, informacoes),
          genealogia = COALESCE(?, genealogia),
          condicoes_cobertura = COALESCE(?, condicoes_cobertura),
          atualizado_em = ?
        WHERE id = ?
      `,
      payloadNormalizado.lote ?? null,
      payloadNormalizado.nome ?? null,
      payloadNormalizado.categoria ?? null,
      payloadNormalizado.vendedor ?? null,
      payloadNormalizado.condicoes_pagamento_especificas ?? null,
      payloadNormalizado.raca ?? null,
      payloadNormalizado.sexo ?? null,
      payloadNormalizado.pelagem ?? null,
      payloadNormalizado.nascimento ?? null,
      payloadNormalizado.informacoes ?? null,
      payloadNormalizado.genealogia ?? null,
      payloadNormalizado.condicoes_cobertura
        ? JSON.stringify(payloadNormalizado.condicoes_cobertura)
        : null,
      atual,
      id
    )

    const [animal] = await prisma.$queryRawUnsafe<any[]>(
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
      `,
      id
    )

    return serializar(animal)
  })

  ipcMain.handle('animais:remover', async (_evt, id: string) => {
    const prisma = await getPrisma()
    await prisma.$executeRawUnsafe(`DELETE FROM Animal WHERE id = ?`, id)
    return true
  })

  ipcMain.handle('animais:removerPorLeilao', async (_evt, leilaoId: string) => {
    const prisma = await getPrisma()
    await prisma.$executeRawUnsafe(`DELETE FROM Animal WHERE leilao_id = ?`, leilaoId)
    return true
  })
}
