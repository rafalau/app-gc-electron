export const CATEGORIAS_ANIMAL = ['ANIMAIS', 'COBERTURAS'] as const

export type CategoriaAnimal = (typeof CATEGORIAS_ANIMAL)[number]

export type Animal = {
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
  peso: string
  informacoes: string
  genealogia: string
  condicoes_cobertura: string[]
  criado_em: string
  atualizado_em: string
}

export type AnimalCriarPayload = {
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
  peso: string
  informacoes: string
  genealogia: string
  condicoes_cobertura: string[]
}

export type AnimalAtualizarPayload = Partial<Omit<AnimalCriarPayload, 'leilao_id'>>

export type AnimalAtualizacaoEmLotePayload = {
  id: string
} & AnimalAtualizarPayload
