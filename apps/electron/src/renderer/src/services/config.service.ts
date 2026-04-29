import type {
  GcApiConfig,
  ModoConfig,
  SrtPreviewStatus,
  VmixConfig,
  VmixInput,
  VmixListItem,
  VmixListState
} from '../types/config'
import type { ApiImportProviderConfig } from '../types/importacao'
import { getFriendlyErrorMessage } from '../utils/errorMessage'

const VMIX_DEFAULT_PORT = 8088
const SRT_DEFAULT_PORT = 9001
const SRT_DEFAULT_NETWORK_CACHING_MS = 200

function normalizarGcApiConfig(config: GcApiConfig): GcApiConfig {
  return {
    baseUrl: String(config.baseUrl ?? '').trim(),
    accessToken: String(config.accessToken ?? '').trim(),
    deviceName: String(config.deviceName ?? 'gc-desktop').trim() || 'gc-desktop',
    lastPulledAt: config.lastPulledAt ? String(config.lastPulledAt) : null
  }
}

function normalizarInput(input: VmixInput | null): VmixInput | null {
  if (!input) return null

  return {
    number: String(input.number ?? ''),
    title: String(input.title ?? ''),
    type: String(input.type ?? ''),
    key: String(input.key ?? '')
  }
}

function normalizarItemLista(item: VmixListItem | null): VmixListItem | null {
  if (!item) return null

  const index = Number(item.index)

  return Number.isInteger(index) && index > 0
    ? {
        index,
        title: String(item.title ?? ''),
        value: String(item.value ?? ''),
        selected: Boolean(item.selected)
      }
    : null
}

function normalizarConfig(config: VmixConfig): VmixConfig {
  const porta = Number(config.porta)
  const portaSrt = Number(config.srt?.porta)
  const networkCachingMs = Number(config.srt?.networkCachingMs)

  return {
    ativo: Boolean(config.ativo),
    ip: String(config.ip ?? '').trim(),
    porta: Number.isInteger(porta) && porta > 0 ? porta : VMIX_DEFAULT_PORT,
    inputSelecionado: normalizarInput(config.inputSelecionado),
    inputSelecionadoCoberturas: normalizarInput(config.inputSelecionadoCoberturas),
    inputLista: normalizarInput(config.inputLista),
    itemListaSelecionado: normalizarItemLista(config.itemListaSelecionado),
    srt: {
      ativo: Boolean(config.srt?.ativo),
      porta: Number.isInteger(portaSrt) && portaSrt > 0 ? portaSrt : SRT_DEFAULT_PORT,
      networkCachingMs:
        Number.isInteger(networkCachingMs) && networkCachingMs >= 0
          ? networkCachingMs
          : SRT_DEFAULT_NETWORK_CACHING_MS
    }
  }
}

export async function obterConfiguracaoVmix(): Promise<VmixConfig> {
  const config = await window.config.getVmix()
  return normalizarConfig(config)
}

export async function obterModoConfig(): Promise<ModoConfig> {
  return window.config.getModoConfig()
}

export async function salvarModoConfig(config: ModoConfig): Promise<void> {
  await window.config.setModo(config)
}

export async function salvarConfiguracaoVmix(config: VmixConfig): Promise<void> {
  await window.config.setVmix(normalizarConfig(config))
}

export async function listarInputsVmix(config: VmixConfig): Promise<VmixInput[]> {
  return window.config.listarInputsVmix(normalizarConfig(config))
}

export async function listarItensListaVmix(
  config: VmixConfig,
  input: VmixInput | null
): Promise<VmixListItem[]> {
  return window.config.listarItensListaVmix(normalizarConfig(config), normalizarInput(input))
}

export async function obterEstadoListaVmix(
  config: VmixConfig,
  input: VmixInput | null
): Promise<VmixListState> {
  return window.config.obterEstadoListaVmix(normalizarConfig(config), normalizarInput(input))
}

export async function selecionarItemListaVmix(
  config: VmixConfig,
  input: VmixInput | null,
  item: VmixListItem | null
): Promise<{ ok: boolean }> {
  return window.config.selecionarItemListaVmix(
    normalizarConfig(config),
    normalizarInput(input),
    normalizarItemLista(item)
  )
}

export async function definirAutoNextListaVmix(
  config: VmixConfig,
  input: VmixInput | null,
  enabled: boolean
): Promise<{ ok: boolean }> {
  return window.config.definirAutoNextListaVmix(normalizarConfig(config), normalizarInput(input), enabled)
}

export async function acionarOverlayVmix(config: VmixConfig): Promise<{ ok: boolean }> {
  return window.config.acionarOverlayVmix(normalizarConfig(config))
}

export async function iniciarPreviewSrt(config: VmixConfig): Promise<SrtPreviewStatus> {
  return window.config.iniciarPreviewSrt(normalizarConfig(config))
}

export async function pararPreviewSrt(): Promise<SrtPreviewStatus> {
  return window.config.pararPreviewSrt()
}

export async function obterStatusPreviewSrt(): Promise<SrtPreviewStatus> {
  return window.config.getStatusPreviewSrt()
}

export async function abrirMonitorSrtExterno(config: VmixConfig): Promise<{ ok: boolean }> {
  return window.config.abrirMonitorSrtExterno(normalizarConfig(config))
}

export async function pararMonitorSrtExterno(): Promise<{ ok: boolean }> {
  return window.config.pararMonitorSrtExterno()
}

export async function obterApiImportProviders(): Promise<ApiImportProviderConfig[]> {
  return window.config.getApiImportProviders()
}

export async function salvarApiImportProviders(providers: ApiImportProviderConfig[]): Promise<void> {
  await window.config.setApiImportProviders(
    providers.map((provider) => ({
      id: String(provider.id ?? ''),
      nome: String(provider.nome ?? ''),
      url: String(provider.url ?? '')
    }))
  )
}

export async function obterConfiguracaoGcApi(): Promise<GcApiConfig> {
  return window.config.getGcApi()
}

export async function salvarConfiguracaoGcApi(config: GcApiConfig): Promise<void> {
  try {
    await window.config.setGcApi(normalizarGcApiConfig(config))
  } catch (error) {
    throw new Error(getFriendlyErrorMessage(error))
  }
}

export async function testarConfiguracaoGcApi(config: GcApiConfig): Promise<{
  ok: boolean
  user?: { id: number | string; name: string; email: string }
}> {
  try {
    return await window.config.testGcApi(normalizarGcApiConfig(config))
  } catch (error) {
    throw new Error(getFriendlyErrorMessage(error))
  }
}
