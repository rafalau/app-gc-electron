export type Leilao = {
  id: string
  titulo_evento: string
  data: string // yyyy-mm-dd
  condicoes_de_pagamento: string
  usa_dolar: boolean
  cotacao: number | null
  multiplicador: number
  criado_em: string
  atualizado_em: string
}

export type LeilaoCriarPayload = {
  titulo_evento: string
  data: string
  condicoes_de_pagamento: string
  usa_dolar: boolean
  cotacao: number | null
  multiplicador: number
}

export type LeilaoAtualizarPayload = Partial<LeilaoCriarPayload>
