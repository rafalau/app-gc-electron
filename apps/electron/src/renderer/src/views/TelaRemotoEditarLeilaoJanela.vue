<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import BaseButton from '@renderer/components/ui/BaseButton.vue'
import BaseSwitch from '@renderer/components/ui/BaseSwitch.vue'
import { applyUppercaseInput } from '@renderer/utils/uppercaseInput'
import type { LeilaoCriarPayload } from '@renderer/types/leilao'

const searchParams = new URLSearchParams(window.location.search)
const leilaoId = searchParams.get('leilaoId') ?? ''
const baseUrl = searchParams.get('baseUrl') ?? ''

const carregando = ref(true)
const salvando = ref(false)
const erro = ref('')
const tituloJanela = ref('Editar Evento')
const dataDisplay = ref('')
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

function isoParaBr(iso: string) {
  const [ano, mes, dia] = String(iso ?? '').split('-')
  if (!ano || !mes || !dia) return ''
  return `${dia}/${mes}/${ano}`
}

function brParaIso(valor: string) {
  const match = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ''
  const [, dia, mes, ano] = match
  return `${ano}-${mes}-${dia}`
}

function formatarDataBr(digitos: string) {
  const dia = digitos.slice(0, 2)
  const mes = digitos.slice(2, 4)
  const ano = digitos.slice(4, 8)
  return [dia, mes, ano].filter(Boolean).join('/')
}

function aplicarMascaraData(event: Event) {
  const target = event.target as HTMLInputElement
  const bruto = target.value
  const digitos = bruto.replace(/\D/g, '').slice(0, 8)
  const digitosAntesCursor = bruto
    .slice(0, target.selectionStart ?? bruto.length)
    .replace(/\D/g, '')
    .slice(0, 8).length

  const formatado = formatarDataBr(digitos)
  dataDisplay.value = formatado
  form.value.data = brParaIso(formatado)
  target.value = formatado

  void nextTick(() => {
    if (document.activeElement !== target) return
    let cursor = digitosAntesCursor
    if (digitosAntesCursor > 2) cursor += 1
    if (digitosAntesCursor > 4) cursor += 1
    target.setSelectionRange(cursor, cursor)
  })
}

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    const leilao = await fetchJson<any>(`/sync/leiloes/${encodeURIComponent(leilaoId)}`)
    if (!leilao) {
      erro.value = 'Evento não encontrado.'
      return
    }

    tituloJanela.value = leilao.titulo_evento ? `Editar Evento - ${leilao.titulo_evento}` : 'Editar Evento'
    document.title = tituloJanela.value
    form.value = {
      titulo_evento: leilao.titulo_evento,
      data: leilao.data,
      condicoes_de_pagamento: leilao.condicoes_de_pagamento,
      usa_dolar: leilao.usa_dolar,
      cotacao: leilao.cotacao,
      multiplicador: leilao.multiplicador
    }
    dataDisplay.value = isoParaBr(leilao.data)
  } catch (errorAtual) {
    erro.value = (errorAtual as Error).message
  } finally {
    carregando.value = false
  }
}

async function salvar() {
  erro.value = ''

  if (!form.value.titulo_evento.trim()) {
    erro.value = 'Informe o nome do evento'
    return
  }

  if (!form.value.data) {
    erro.value = 'Informe a data do evento'
    return
  }

  if (!Number.isInteger(form.value.multiplicador) || form.value.multiplicador <= 0) {
    erro.value = 'Multiplicador deve ser um número inteiro maior que 0'
    return
  }

  if (form.value.usa_dolar && (!form.value.cotacao || form.value.cotacao <= 0)) {
    erro.value = 'Cotação é obrigatória quando usa dólar'
    return
  }

  salvando.value = true
  try {
    await fetchJson(`/sync/leiloes/${encodeURIComponent(leilaoId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo_evento: form.value.titulo_evento,
        data: form.value.data,
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
        <div class="text-lg font-bold">Editar Evento</div>
        <div v-if="tituloJanela" class="mt-1 text-sm text-blue-100">{{ tituloJanela }}</div>
      </div>

      <div class="px-6 py-6">
        <div v-if="erro" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {{ erro }}
        </div>

        <div v-if="carregando" class="text-sm text-slate-500">Carregando...</div>

        <div v-else class="grid grid-cols-12 gap-5">
          <div class="col-span-12 md:col-span-8">
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Nome do Evento
            </label>
            <input
              :value="form.titulo_evento"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              type="text"
              @input="applyUppercaseInput($event, (value) => (form.titulo_evento = value))"
            />
          </div>

          <div class="col-span-12 md:col-span-4">
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Data do Evento
            </label>
            <input
              :value="dataDisplay"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              type="text"
              inputmode="numeric"
              maxlength="10"
              placeholder="DD/MM/AAAA"
              @input="aplicarMascaraData"
            />
          </div>

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
              :value="form.condicoes_de_pagamento"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              type="text"
              @input="
                applyUppercaseInput($event, (value) => (form.condicoes_de_pagamento = value))
              "
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
