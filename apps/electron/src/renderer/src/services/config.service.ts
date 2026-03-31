import type { VmixConfig, VmixInput } from '../types/config'

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
    inputSelecionado: normalizarInput(config.inputSelecionado)
  }
}

export async function obterConfiguracaoVmix(): Promise<VmixConfig> {
  const config = await window.config.getVmix()
  return normalizarConfig(config)
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
