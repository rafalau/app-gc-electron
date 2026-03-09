import type { Leilao, LeilaoCriarPayload, LeilaoAtualizarPayload } from '../types/leilao'

export async function listarLeiloes(): Promise<Leilao[]> {
  return window.leiloes.listar()
}

export async function criarLeilao(payload: LeilaoCriarPayload): Promise<Leilao> {
  return window.leiloes.criar(payload)
}

export async function atualizarLeilao(
  id: string,
  payload: LeilaoAtualizarPayload
): Promise<Leilao> {
  return window.leiloes.atualizar(id, payload)
}

export async function removerLeilao(id: string): Promise<boolean> {
  return window.leiloes.remover(id)
}
