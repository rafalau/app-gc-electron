import type {
  OperacaoArquivoInfo,
  OperacaoEstadoPayload,
  OperacaoEstadoPersistido
} from '../types/operacao'

export async function obterArquivoOperacao(leilaoId: string): Promise<OperacaoArquivoInfo> {
  return window.operacao.obterArquivo(leilaoId)
}

export async function obterEstadoOperacao(leilaoId: string): Promise<OperacaoEstadoPersistido | null> {
  return window.operacao.obterEstado(leilaoId)
}

export async function atualizarArquivoOperacao(
  leilaoId: string,
  payload: OperacaoEstadoPayload
): Promise<OperacaoArquivoInfo> {
  return window.operacao.atualizarArquivo(leilaoId, payload)
}
