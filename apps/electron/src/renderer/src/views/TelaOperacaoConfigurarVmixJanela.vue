<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BaseButton from '@renderer/components/ui/BaseButton.vue'
import BaseSwitch from '@renderer/components/ui/BaseSwitch.vue'
import { applyUppercaseInput } from '@renderer/utils/uppercaseInput'
import type { ModoConfig, VmixConfig, VmixInput } from '@renderer/types/config'

const HOST_DEFAULT_IP = '127.0.0.1'
const VMIX_DEFAULT_PORT = 8088
const SRT_DEFAULT_PORT = 9001
const SRT_DEFAULT_NETWORK_CACHING_MS = 200
const windowComConfig = window as unknown as {
  config?: Partial<Window['config']>
}

const carregando = ref(true)
const salvando = ref(false)
const carregandoInputs = ref(false)
const erro = ref('')
const erroInputs = ref('')
const modoOperacao = ref<'HOST' | 'REMOTO' | null>(null)
const modoConfig = ref<ModoConfig | null>(null)
const inputs = ref<VmixInput[]>([])
const inputsLista = computed(() =>
  inputs.value.filter((input) => String(input.type ?? '').toLowerCase().includes('list'))
)
const form = ref<VmixConfig>({
  ativo: false,
  ip: '',
  porta: VMIX_DEFAULT_PORT,
  inputSelecionado: null,
  inputSelecionadoCoberturas: null,
  inputLista: null,
  itemListaSelecionado: null,
  srt: {
    ativo: false,
    porta: SRT_DEFAULT_PORT,
    networkCachingMs: SRT_DEFAULT_NETWORK_CACHING_MS
  }
})

function getConfigApi(): Window['config'] {
  const config = windowComConfig.config
  if (
    !config?.getVmix ||
    !config?.setVmix ||
    !config.getModoConfig ||
    !config.listarInputsVmix
  ) {
    throw new Error('API local de configuração indisponível nesta janela.')
  }

  return config as Window['config']
}

async function obterConfigJanela(): Promise<{ config: VmixConfig; conexao: ModoConfig }> {
  const configApi = getConfigApi()
  const [config, conexao] = await Promise.all([
    configApi.getVmix(),
    configApi.getModoConfig()
  ])
  return { config, conexao }
}

async function listarInputsJanela() {
  const configApi = getConfigApi()
  return configApi.listarInputsVmix(normalizarConfigFormulario(form.value))
}

async function salvarConfigJanela() {
  const configApi = getConfigApi()
  await configApi.setVmix(normalizarConfigFormulario(form.value))
}

function getIpPadraoVmix(conexao?: ModoConfig | null) {
  if (conexao?.modo === 'REMOTO') return conexao.hostIp.trim()
  return HOST_DEFAULT_IP
}

function aplicarDefaultsFormulario(config: VmixConfig, conexao: ModoConfig): VmixConfig {
  const ipPadraoVmix = getIpPadraoVmix(conexao)
  const ipVmix = String(config.ip ?? '').trim() || ipPadraoVmix
  const networkCachingMs = Number(config.srt?.networkCachingMs)

  return {
    ...config,
    ip: ipVmix,
    porta: Number(config.porta) > 0 ? config.porta : VMIX_DEFAULT_PORT,
    inputSelecionado: config.inputSelecionado ?? null,
    inputSelecionadoCoberturas: config.inputSelecionadoCoberturas ?? null,
    inputLista: config.inputLista ?? null,
    itemListaSelecionado: config.itemListaSelecionado ?? null,
    srt: {
      ...config.srt,
      porta: Number(config.srt?.porta) > 0 ? config.srt.porta : SRT_DEFAULT_PORT,
      networkCachingMs:
        Number.isInteger(networkCachingMs) && networkCachingMs >= 0
          ? networkCachingMs
          : SRT_DEFAULT_NETWORK_CACHING_MS
    }
  }
}

function normalizarConfigFormulario(config: VmixConfig): VmixConfig {
  const porta = Number(config.porta)
  const portaSrt = Number(config.srt?.porta)
  const networkCachingMs = Number(config.srt?.networkCachingMs)

  return {
    ativo: Boolean(config.ativo),
    ip: String(config.ip ?? '').trim(),
    porta: Number.isInteger(porta) && porta > 0 ? porta : VMIX_DEFAULT_PORT,
    inputSelecionado: config.inputSelecionado
      ? {
          key: String(config.inputSelecionado.key ?? '').trim(),
          number: String(config.inputSelecionado.number ?? '').trim(),
          title: String(config.inputSelecionado.title ?? '').trim(),
          type: String(config.inputSelecionado.type ?? '').trim()
        }
      : null,
    inputSelecionadoCoberturas: config.inputSelecionadoCoberturas
      ? {
          key: String(config.inputSelecionadoCoberturas.key ?? '').trim(),
          number: String(config.inputSelecionadoCoberturas.number ?? '').trim(),
          title: String(config.inputSelecionadoCoberturas.title ?? '').trim(),
          type: String(config.inputSelecionadoCoberturas.type ?? '').trim()
        }
      : null,
    inputLista: config.inputLista
      ? {
          key: String(config.inputLista.key ?? '').trim(),
          number: String(config.inputLista.number ?? '').trim(),
          title: String(config.inputLista.title ?? '').trim(),
          type: String(config.inputLista.type ?? '').trim()
        }
      : null,
    itemListaSelecionado:
      config.itemListaSelecionado && Number(config.itemListaSelecionado.index) > 0
        ? {
            index: Number(config.itemListaSelecionado.index),
            title: String(config.itemListaSelecionado.title ?? '').trim(),
            value: String(config.itemListaSelecionado.value ?? '').trim(),
            selected: Boolean(config.itemListaSelecionado.selected)
          }
        : null,
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

async function carregar() {
  carregando.value = true
  erro.value = ''
  erroInputs.value = ''

  try {
    const { config, conexao } = await obterConfigJanela()
    modoConfig.value = conexao
    form.value = aplicarDefaultsFormulario(config, conexao)
    modoOperacao.value = conexao.modo
    document.title = 'Configuração do vMix'

    if (config.ativo) {
      await carregarListaInputs()
    }
  } catch (errorAtual) {
    erro.value = (errorAtual as Error).message
  } finally {
    carregando.value = false
  }
}

async function carregarListaInputs() {
  erroInputs.value = ''
  carregandoInputs.value = true

  try {
    inputs.value = await listarInputsJanela()
    if (
      form.value.inputLista &&
      !inputs.value.some((input) => input.key === form.value.inputLista?.key)
    ) {
      form.value.inputLista = null
      form.value.itemListaSelecionado = null
    }
  } catch (errorAtual) {
    erroInputs.value = (errorAtual as Error).message
    inputs.value = []
  } finally {
    carregandoInputs.value = false
  }
}

function resetarIpPadraoHostVmix() {
  form.value = {
    ...form.value,
    ip: HOST_DEFAULT_IP
  }
  erro.value = ''
  erroInputs.value = ''
}

function selecionarInputVmix(event: Event) {
  const key = (event.target as HTMLSelectElement).value
  form.value = {
    ...form.value,
    inputSelecionado: inputs.value.find((input) => input.key === key) ?? null
  }
}

function selecionarInputVmixCoberturas(event: Event) {
  const key = (event.target as HTMLSelectElement).value
  form.value = {
    ...form.value,
    inputSelecionadoCoberturas: inputs.value.find((input) => input.key === key) ?? null
  }
}

function selecionarInputListaVmix(event: Event) {
  const key = (event.target as HTMLSelectElement).value
  form.value = {
    ...form.value,
    inputLista: inputs.value.find((input) => input.key === key) ?? null,
    itemListaSelecionado: null
  }
}

async function salvar() {
  erro.value = ''
  form.value = aplicarDefaultsFormulario(
    form.value,
    modoConfig.value ?? {
      modo: modoOperacao.value,
      hostIp: '',
      portaApp: 18452
    }
  )

  if (form.value.ativo) {
    if (!form.value.ip.trim()) {
      erro.value = 'Informe o IP do vMix'
      return
    }
    if (!Number.isInteger(Number(form.value.porta)) || Number(form.value.porta) <= 0) {
      erro.value = 'Informe uma porta válida do vMix'
      return
    }
  }

  if (form.value.srt.ativo) {
    if (!Number.isInteger(Number(form.value.srt.porta)) || Number(form.value.srt.porta) <= 0) {
      erro.value = 'Informe uma porta SRT válida'
      return
    }
    if (
      !Number.isInteger(Number(form.value.srt.networkCachingMs)) ||
      Number(form.value.srt.networkCachingMs) < 0
    ) {
      erro.value = 'Informe um network-caching SRT válido'
      return
    }
  }

  salvando.value = true
  try {
    await salvarConfigJanela()
    window.close()
  } catch (errorAtual) {
    erro.value = (errorAtual as Error).message
  } finally {
    salvando.value = false
  }
}

function fecharJanela() {
  window.close()
}

onMounted(() => {
  void carregar()
})
</script>

<template>
  <div class="min-h-screen bg-slate-100 p-4">
    <div class="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white">
        <div class="text-lg font-bold">Configuração do vMix</div>
      </div>

      <div class="px-6 py-6">
        <div v-if="erro" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {{ erro }}
        </div>

        <div v-if="carregando" class="text-sm text-slate-500">Carregando...</div>

        <div v-else class="grid grid-cols-12 gap-5">
          <div class="col-span-12">
            <div class="flex h-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
              <div>
                <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Integração</div>
                <label class="mt-1 block text-sm font-medium text-slate-800">Ativar vMix?</label>
              </div>
              <BaseSwitch v-model="form.ativo" />
            </div>
          </div>

          <div class="col-span-12">
            <div class="flex h-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
              <div>
                <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Tela SRT</div>
                <label class="mt-1 block text-sm font-medium text-slate-800">Ativar SRT?</label>
              </div>
              <BaseSwitch v-model="form.srt.ativo" />
            </div>
          </div>

          <div class="col-span-12 md:col-span-7">
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              IP do vMix
            </label>
            <input
              :value="form.ip"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 read-only:cursor-not-allowed read-only:bg-slate-100 read-only:text-slate-500"
              type="text"
              placeholder="Ex.: 192.168.0.50"
              @input="applyUppercaseInput($event, (value) => (form.ip = value))"
            />
          </div>

          <div v-if="form.ativo" class="col-span-12 md:col-span-5">
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Porta
            </label>
            <input
              v-model.number="form.porta"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              type="number"
              min="1"
              max="65535"
              step="1"
              placeholder="8088"
            />
          </div>

          <div v-if="form.srt.ativo" class="col-span-12 md:col-span-5">
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Porta SRT
            </label>
            <input
              v-model.number="form.srt.porta"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              type="number"
              min="1"
              max="65535"
              step="1"
              placeholder="9001"
            />
          </div>

          <div v-if="form.srt.ativo" class="col-span-12 md:col-span-7">
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Network-caching SRT (ms)
            </label>
            <input
              v-model.number="form.srt.networkCachingMs"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              type="number"
              min="0"
              max="10000"
              step="50"
              placeholder="200"
            />
          </div>

          <div v-if="form.ativo" class="col-span-12">
            <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div class="text-sm text-slate-600">Buscar inputs disponíveis no vMix configurado.</div>
              <BaseButton :disabled="carregandoInputs || !form.ativo" @click="carregarListaInputs">
                {{ carregandoInputs ? 'Buscando...' : 'Atualizar' }}
              </BaseButton>
            </div>
          </div>

          <div
            v-if="form.ativo && erroInputs"
            class="col-span-12 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {{ erroInputs }}
          </div>

          <div v-if="form.ativo" class="col-span-12">
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Input GC
            </label>
            <div class="relative">
              <select
                :value="form.inputSelecionado?.key ?? ''"
                class="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                :disabled="!form.ativo || carregandoInputs || inputs.length === 0"
                @change="selecionarInputVmix"
              >
                <option value="">NÃO SELECIONADO</option>
                <option v-for="input in inputs" :key="input.key" :value="input.key">
                  {{ input.title || `Input ${input.number}` }} | #{{ input.number }} | {{ input.type }}
                </option>
              </select>
              <i class="fas fa-chevron-down pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
            </div>
          </div>

          <div v-if="form.ativo" class="col-span-12">
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Input GC Coberturas
            </label>
            <div class="relative">
              <select
                :value="form.inputSelecionadoCoberturas?.key ?? ''"
                class="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                :disabled="!form.ativo || carregandoInputs || inputs.length === 0"
                @change="selecionarInputVmixCoberturas"
              >
                <option value="">NÃO SELECIONADO</option>
                <option v-for="input in inputs" :key="input.key" :value="input.key">
                  {{ input.title || `Input ${input.number}` }} | #{{ input.number }} | {{ input.type }}
                </option>
              </select>
              <i class="fas fa-chevron-down pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
            </div>
          </div>

          <div v-if="form.ativo" class="col-span-12">
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Input LIST
            </label>
            <div class="relative">
              <select
                :value="form.inputLista?.key ?? ''"
                class="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                :disabled="!form.ativo || carregandoInputs || inputsLista.length === 0"
                @change="selecionarInputListaVmix"
              >
                <option value="">NÃO SELECIONADO</option>
                <option v-for="input in inputsLista" :key="input.key" :value="input.key">
                  {{ input.title || `Input ${input.number}` }} | #{{ input.number }} | {{ input.type }}
                </option>
              </select>
              <i class="fas fa-chevron-down pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
            </div>
          </div>

          <div class="col-span-12">
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Padrões do host: IP <strong>127.0.0.1</strong>, vMix <strong>8088</strong> e SRT
              <strong>9001</strong>. Network-caching SRT padrão: <strong>200ms</strong>.
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
        <BaseButton
          v-if="modoOperacao === 'HOST'"
          variante="secundario"
          :disabled="salvando"
          @click="resetarIpPadraoHostVmix"
        >
          Resetar IP padrão
        </BaseButton>
        <BaseButton :disabled="salvando" @click="fecharJanela">Cancelar</BaseButton>
        <BaseButton variante="primario" :disabled="carregando || salvando" @click="salvar">
          {{ salvando ? 'Salvando...' : 'Salvar' }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>
