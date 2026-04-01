import type {
  OperacaoArquivoInfo,
  OperacaoConexaoInfo,
  OperacaoEstadoPayload,
  OperacaoEstadoPersistido
} from '../types/operacao'

export async function obterArquivoOperacao(leilaoId: string): Promise<OperacaoArquivoInfo> {
  return window.operacao.obterArquivo(leilaoId)
}

export async function obterEstadoOperacao(leilaoId: string): Promise<OperacaoEstadoPersistido | null> {
  return window.operacao.obterEstado(leilaoId)
}

export async function obterConexaoOperacao(): Promise<OperacaoConexaoInfo> {
  return window.operacao.obterConexao()
}

export async function atualizarArquivoOperacao(
  leilaoId: string,
  payload: OperacaoEstadoPayload
): Promise<OperacaoArquivoInfo> {
  return window.operacao.atualizarArquivo(leilaoId, payload)
}
