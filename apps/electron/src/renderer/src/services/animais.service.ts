import type { Animal, AnimalAtualizarPayload, AnimalCriarPayload } from '../types/animal'

export async function listarAnimaisPorLeilao(leilaoId: string): Promise<Animal[]> {
  return window.animais.listarPorLeilao(leilaoId)
}

export async function criarAnimal(payload: AnimalCriarPayload): Promise<Animal> {
  return window.animais.criar(payload)
}

export async function atualizarAnimal(id: string, payload: AnimalAtualizarPayload): Promise<Animal> {
  return window.animais.atualizar(id, payload)
}

export async function removerAnimal(id: string): Promise<boolean> {
  return window.animais.remover(id)
}

export async function removerAnimaisPorLeilao(leilaoId: string): Promise<boolean> {
  return window.animais.removerPorLeilao(leilaoId)
}
