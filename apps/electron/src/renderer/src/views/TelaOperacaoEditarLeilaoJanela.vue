<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BaseButton from '@renderer/components/ui/BaseButton.vue'
import BaseSwitch from '@renderer/components/ui/BaseSwitch.vue'
import type { LeilaoCriarPayload } from '@renderer/types/leilao'

const searchParams = new URLSearchParams(window.location.search)
const leilaoId = searchParams.get('leilaoId') ?? ''
const baseUrl = searchParams.get('baseUrl') ?? ''

const carregando = ref(true)
const salvando = ref(false)
const erro = ref('')
const tituloLeilao = ref('')
const form = ref<LeilaoCriarPayload>({
  titulo_evento: '',
  data: '',
  condicoes_de_pagamento: '',
  usa_dolar: false,
  cotacao: null,
  multiplicador: 1
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

  try {
    const leilao = await fetchJson<any>(`/sync/leiloes/${encodeURIComponent(leilaoId)}`)
    if (!leilao) {
      erro.value = 'Leilão não encontrado.'
      return
    }

    tituloLeilao.value = leilao.titulo_evento
    document.title = `Editar Operação - ${leilao.titulo_evento}`
    form.value = {
      titulo_evento: leilao.titulo_evento,
      data: leilao.data,
      condicoes_de_pagamento: leilao.condicoes_de_pagamento,
      usa_dolar: leilao.usa_dolar,
      cotacao: leilao.cotacao,
      multiplicador: leilao.multiplicador
    }
  } catch (errorAtual) {
    erro.value = (errorAtual as Error).message
  } finally {
    carregando.value = false
  }
}

async function salvar() {
  erro.value = ''

  if (!Number.isInteger(form.value.multiplicador) || form.value.multiplicador <= 0) {
    erro.value = 'Multiplicador deve ser um número inteiro maior que 0'
    return
  }

  if (form.value.usa_dolar) {
    if (!form.value.cotacao || form.value.cotacao <= 0) {
      erro.value = 'Cotação é obrigatória quando usa dólar'
      return
    }
  }

  salvando.value = true
  try {
    await fetchJson(`/sync/leiloes/${encodeURIComponent(leilaoId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
      condicoes_de_pagamento: form.value.condicoes_de_pagamento,
      usa_dolar: form.value.usa_dolar,
      cotacao: form.value.usa_dolar ? form.value.cotacao : null,
      multiplicador: form.value.multiplicador
      })
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
    <div class="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white">
        <div class="text-lg font-bold">Editar Operação</div>
        <div v-if="tituloLeilao" class="mt-1 text-sm text-blue-100">{{ tituloLeilao }}</div>
      </div>

      <div class="px-6 py-6">
        <div v-if="erro" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {{ erro }}
        </div>

        <div v-if="carregando" class="text-sm text-slate-500">Carregando...</div>

        <div v-else class="grid grid-cols-12 gap-5">
          <div class="col-span-12 md:col-span-4">
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Multiplicador
            </label>
            <input
              v-model.number="form.multiplicador"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              type="number"
              min="1"
              step="1"
            />
          </div>

          <div class="col-span-12 md:col-span-8">
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Condições Pagto.
            </label>
            <input
              v-model="form.condicoes_de_pagamento"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              type="text"
            />
          </div>

          <div class="col-span-12 md:col-span-6">
            <div class="flex h-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
              <div>
                <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Moeda</div>
                <label class="mt-1 block text-sm font-medium text-slate-800">Usar dólar?</label>
              </div>
              <BaseSwitch v-model="form.usa_dolar" />
            </div>
          </div>

          <div class="col-span-12 md:col-span-6">
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Cotação do Dólar
            </label>
            <input
              v-model.number="form.cotacao"
              :disabled="!form.usa_dolar"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              type="number"
              min="0"
              step="0.01"
            />
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
        <BaseButton :disabled="salvando" @click="fecharJanela">Cancelar</BaseButton>
        <BaseButton variante="primario" :disabled="carregando || salvando" @click="salvar">
          {{ salvando ? 'Salvando...' : 'Salvar' }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>
