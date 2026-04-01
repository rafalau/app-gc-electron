import type { ModoConfig, SrtPreviewStatus, VmixConfig, VmixInput } from '../types/config'

function normalizarInput(input: VmixInput | null): VmixInput | null {
  if (!input) return null

  return {
    number: String(input.number ?? ''),
    title: String(input.title ?? ''),
    type: String(input.type ?? ''),
    key: String(input.key ?? '')
  }
}

function normalizarConfig(config: VmixConfig): VmixConfig {
  return {
    ativo: Boolean(config.ativo),
    ip: String(config.ip ?? '').trim(),
    porta: Number(config.porta) || 8088,
    inputSelecionado: normalizarInput(config.inputSelecionado),
    srt: {
      ativo: Boolean(config.srt?.ativo),
      porta: config.srt?.porta ? Number(config.srt.porta) : null
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
