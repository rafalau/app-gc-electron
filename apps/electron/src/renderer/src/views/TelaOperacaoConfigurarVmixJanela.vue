<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BaseButton from '@renderer/components/ui/BaseButton.vue'
import BaseSwitch from '@renderer/components/ui/BaseSwitch.vue'
import { applyUppercaseInput } from '@renderer/utils/uppercaseInput'
import type { VmixConfig, VmixInput } from '@renderer/types/config'

const HOST_DEFAULT_IP = '127.0.0.1'
const VMIX_DEFAULT_PORT = 8088
const SRT_DEFAULT_PORT = 9001
const searchParams = new URLSearchParams(window.location.search)
const baseUrl = searchParams.get('baseUrl') ?? ''

const carregando = ref(true)
const salvando = ref(false)
const carregandoInputs = ref(false)
const erro = ref('')
const erroInputs = ref('')
const modoOperacao = ref<'HOST' | 'REMOTO' | null>(null)
const inputs = ref<VmixInput[]>([])
const form = ref<VmixConfig>({
  ativo: false,
  ip: '',
  porta: VMIX_DEFAULT_PORT,
  inputSelecionado: null,
  srt: {
    ativo: false,
    porta: SRT_DEFAULT_PORT
  }
})

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, init)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Falha HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

async function carregar() {
  carregando.value = true
  erro.value = ''
  erroInputs.value = ''

  try {
    const [config, conexao] = await Promise.all([
      fetchJson<VmixConfig>('/sync/config/vmix'),
      fetchJson<{ modo: 'HOST' | 'REMOTO' | null }>('/sync/conexao')
    ])
    form.value = config
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
    inputs.value = await fetchJson<VmixInput[]>('/sync/config/vmix/inputs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
  } catch (errorAtual) {
    erroInputs.value = (errorAtual as Error).message
    inputs.value = []
  } finally {
    carregandoInputs.value = false
  }
}

function restaurarPadroesHostVmix() {
  form.value = {
    ...form.value,
    ip: HOST_DEFAULT_IP,
    porta: VMIX_DEFAULT_PORT,
    srt: {
      ...form.value.srt,
      porta: SRT_DEFAULT_PORT
    }
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

async function salvar() {
  erro.value = ''

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
  }

  salvando.value = true
  try {
    await fetchJson('/sync/config/vmix', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
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
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              type="text"
              placeholder="Ex.: 192.168.0.50"
              @input="applyUppercaseInput($event, (value) => (form.ip = value))"
            />
          </div>

          <div class="col-span-12 md:col-span-5">
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

          <div class="col-span-12 md:col-span-5">
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

          <div class="col-span-12">
            <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div class="text-sm text-slate-600">Buscar inputs disponíveis no vMix configurado.</div>
              <BaseButton :disabled="carregandoInputs || !form.ativo" @click="carregarListaInputs">
                {{ carregandoInputs ? 'Buscando...' : 'Atualizar' }}
              </BaseButton>
            </div>
          </div>

          <div
            v-if="erroInputs"
            class="col-span-12 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {{ erroInputs }}
          </div>

          <div class="col-span-12">
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Input do vMix
            </label>
            <div class="relative">
              <select
                :value="form.inputSelecionado?.key ?? ''"
                class="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                :disabled="!form.ativo || carregandoInputs || inputs.length === 0"
                @change="selecionarInputVmix"
              >
                <option value="">Selecione um input</option>
                <option v-for="input in inputs" :key="input.key" :value="input.key">
                  {{ input.title || `Input ${input.number}` }} | #{{ input.number }} | {{ input.type }}
                </option>
              </select>
              <i class="fas fa-chevron-down pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
            </div>
          </div>

          <div
            v-if="form.inputSelecionado"
            class="col-span-12 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            Input salvo: {{ form.inputSelecionado.title || `Input ${form.inputSelecionado.number}` }}
            (#{{ form.inputSelecionado.number }}) - {{ form.inputSelecionado.type }}
          </div>

          <div class="col-span-12">
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Padrões do host: IP <strong>127.0.0.1</strong>, vMix <strong>8088</strong> e SRT
              <strong>9001</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
        <BaseButton
          v-if="modoOperacao === 'HOST'"
          variante="secundario"
          :disabled="salvando"
          @click="restaurarPadroesHostVmix"
        >
          Restaurar padrões
        </BaseButton>
        <BaseButton :disabled="salvando" @click="fecharJanela">Cancelar</BaseButton>
        <BaseButton variante="primario" :disabled="carregando || salvando" @click="salvar">
          {{ salvando ? 'Salvando...' : 'Salvar' }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>
