import type { GcApiSyncSummary } from '../types/config'
import { getFriendlyErrorMessage } from '../utils/errorMessage'

export async function sincronizarGcApi(): Promise<GcApiSyncSummary> {
  try {
    return await window.gcSync.sincronizarTudo()
  } catch (error) {
    throw new Error(getFriendlyErrorMessage(error))
  }
}

export async function sincronizarLeilaoGcApi(leilaoId: string): Promise<GcApiSyncSummary> {
  try {
    return await window.gcSync.sincronizarLeilao(leilaoId)
  } catch (error) {
    throw new Error(getFriendlyErrorMessage(error))
  }
}
