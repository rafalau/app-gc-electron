<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseSwitch from '../ui/BaseSwitch.vue'
import type { LeilaoCriarPayload } from '@renderer/types/leilao'
import type { ModalLeilaoModo } from '@renderer/composables/useLeiloes'
import { applyUppercaseInput } from '@renderer/utils/uppercaseInput'

const props = defineProps<{
  aberto: boolean
  modo: ModalLeilaoModo
  form: LeilaoCriarPayload
  erro: string
}>()

const emit = defineEmits<{
  (e: 'fechar'): void
  (e: 'salvar', payload: LeilaoCriarPayload): void
}>()

const formLocal = reactive<LeilaoCriarPayload>({
  titulo_evento: '',
  data: '',
  multiplicador: 1,
  condicoes_de_pagamento: '',
  usa_dolar: false,
  cotacao: 0
})
const dataDisplay = ref('')

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
  formLocal.data = brParaIso(formatado)
  target.value = formatado

  void nextTick(() => {
    if (document.activeElement !== target) return
    let cursor = digitosAntesCursor
    if (digitosAntesCursor > 2) cursor += 1
    if (digitosAntesCursor > 4) cursor += 1
    target.setSelectionRange(cursor, cursor)
  })
}

const sincronizarForm = () => {
  formLocal.titulo_evento = props.form.titulo_evento
  formLocal.data = props.form.data
  dataDisplay.value = isoParaBr(props.form.data)
  formLocal.multiplicador = props.form.multiplicador
  formLocal.condicoes_de_pagamento = props.form.condicoes_de_pagamento
  formLocal.usa_dolar = props.form.usa_dolar
  formLocal.cotacao = props.form.cotacao
}

watch(
  () => props.form,
  () => {
    sincronizarForm()
  },
  { deep: true, immediate: true }
)

watch(
  () => props.aberto,
  (aberto) => {
    if (aberto) {
      sincronizarForm()
    }
  }
)

watch(
  () => formLocal.usa_dolar,
  (valor) => {
    if (!valor) {
      formLocal.cotacao = 0
    }
  }
)

const salvar = () => {
  emit('salvar', { ...formLocal })
}
</script>

<template>
  <BaseModal
    :aberto="aberto"
    :titulo="modo === 'CRIAR' ? 'Novo Evento' : 'Editar Evento'"
    @fechar="emit('fechar')"
  >
    <div
      v-if="erro"
      class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
    >
      {{ erro }}
    </div>

    <div class="grid grid-cols-12 gap-5">
      <div class="col-span-12 md:col-span-8">
        <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
          Nome do Evento *
        </label>
        <input
          v-model="formLocal.titulo_evento"
          class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          type="text"
          @input="applyUppercaseInput($event, (value) => (formLocal.titulo_evento = value))"
        />
      </div>

      <div class="col-span-12 md:col-span-4">
        <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
          Data do Evento *
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
        <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
          Multiplicador *
        </label>
        <input
          v-model.number="formLocal.multiplicador"
          class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          type="number"
          min="0"
          step="0.01"
        />
      </div>

      <div class="col-span-12 md:col-span-8">
        <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
          Condições Pagto.
        </label>
        <input
          v-model="formLocal.condicoes_de_pagamento"
          class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          type="text"
          @input="
            applyUppercaseInput($event, (value) => (formLocal.condicoes_de_pagamento = value))
          "
        />
      </div>

      <div class="col-span-12 md:col-span-6">
        <div
          class="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm h-full"
        >
          <div>
            <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Moeda
            </div>
            <label class="text-sm font-medium text-slate-800 mt-1 block"> Usar dólar? </label>
          </div>
          <BaseSwitch v-model="formLocal.usa_dolar" />
        </div>
      </div>

      <div class="col-span-12 md:col-span-6">
        <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
          Cotação do Dólar
        </label>

        <input
          v-model.number="formLocal.cotacao"
          :disabled="!formLocal.usa_dolar"
          class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          type="number"
          min="0"
          step="0.01"
        />
      </div>
    </div>

    <template #footer>
      <BaseButton @click="emit('fechar')"> Cancelar </BaseButton>

      <BaseButton variante="primario" @click="salvar">
        {{ modo === 'CRIAR' ? 'Criar Evento' : 'Salvar Alterações' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
