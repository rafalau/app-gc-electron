import { ipcMain } from 'electron'
import { getPrisma } from '../db/prisma'

type LeilaoCriarPayload = {
  titulo_evento: string
  data: string
  condicoes_de_pagamento: string
  usa_dolar: boolean
  cotacao: number | null
  multiplicador: number
}

type LeilaoAtualizarPayload = Partial<LeilaoCriarPayload>

function serializar(leilao: any) {
  return {
    ...leilao,
    criado_em: leilao.criado_em instanceof Date ? leilao.criado_em.toISOString() : leilao.criado_em,
    atualizado_em: leilao.atualizado_em instanceof Date ? leilao.atualizado_em.toISOString() : leilao.atualizado_em
  }
}

export function registrarIpcLeiloes() {
  ipcMain.handle('leiloes:listar', async () => {
    const prisma = await getPrisma()
    const leiloes = await prisma.leilao.findMany({
      orderBy: [{ data: 'desc' }]
    })
    return leiloes.map(serializar)
  })

  ipcMain.handle('leiloes:criar', async (_evt, payload: LeilaoCriarPayload) => {
    const prisma = await getPrisma()
    const leilao = await prisma.leilao.create({
      data: {
        titulo_evento: payload.titulo_evento,
        data: payload.data,
        condicoes_de_pagamento: payload.condicoes_de_pagamento ?? '',
        usa_dolar: payload.usa_dolar ?? false,
        cotacao: payload.cotacao,
        multiplicador: payload.multiplicador
      }
    })
    return serializar(leilao)
  })

  ipcMain.handle('leiloes:atualizar', async (_evt, id: string, payload: LeilaoAtualizarPayload) => {
    const prisma = await getPrisma()
    const leilao = await prisma.leilao.update({
      where: { id },
      data: {
        ...(payload.titulo_evento !== undefined ? { titulo_evento: payload.titulo_evento } : {}),
        ...(payload.data !== undefined ? { data: payload.data } : {}),
        ...(payload.condicoes_de_pagamento !== undefined ? { condicoes_de_pagamento: payload.condicoes_de_pagamento } : {}),
        ...(payload.usa_dolar !== undefined ? { usa_dolar: payload.usa_dolar } : {}),
        ...(payload.cotacao !== undefined ? { cotacao: payload.cotacao } : {}),
        ...(payload.multiplicador !== undefined ? { multiplicador: payload.multiplicador } : {}),
        atualizado_em: new Date()
      }
    })
    return serializar(leilao)
  })

  ipcMain.handle('leiloes:remover', async (_evt, id: string) => {
    const prisma = await getPrisma()
    await prisma.leilao.delete({ where: { id } })
    return true
  })
}
