<script setup lang="ts">
import { reactive, watch } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseSwitch from '../ui/BaseSwitch.vue'
import type { LeilaoCriarPayload } from '@renderer/types/leilao'
import type { ModalLeilaoModo } from '@renderer/composables/useLeiloes'

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

const sincronizarForm = () => {
  formLocal.titulo_evento = props.form.titulo_evento
  formLocal.data = props.form.data
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
      <div class="col-span-12">
        <label class="block text-sm font-semibold text-gray-700 mb-2"> Nome do Evento * </label>
        <input
          v-model="formLocal.titulo_evento"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          type="text"
        />
      </div>

      <div class="col-span-12">
        <label class="block text-sm font-semibold text-gray-700 mb-2"> Data do Evento * </label>
        <input
          v-model="formLocal.data"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          type="date"
        />
      </div>

      <div class="col-span-12 md:col-span-3">
        <label class="block text-sm font-semibold text-gray-700 mb-2"> Multiplicador * </label>
        <input
          v-model.number="formLocal.multiplicador"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          type="number"
          min="0"
          step="0.01"
        />
      </div>

      <div class="col-span-12 md:col-span-9">
        <label class="block text-sm font-semibold text-gray-700 mb-2">
          Condições de Pagamento
        </label>
        <input
          v-model="formLocal.condicoes_de_pagamento"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          type="text"
        />
      </div>

      <div class="col-span-12 md:col-span-6">
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg h-full">
          <label class="text-sm font-medium text-gray-700"> Usar dólar? </label>
          <BaseSwitch v-model="formLocal.usa_dolar" />
        </div>
      </div>

      <div class="col-span-12 md:col-span-6">
        <label class="block text-sm font-semibold text-gray-700 mb-2"> Cotação do Dólar </label>

        <input
          v-model.number="formLocal.cotacao"
          :disabled="!formLocal.usa_dolar"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
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
