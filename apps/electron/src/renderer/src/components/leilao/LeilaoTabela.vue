<script setup lang="ts">
import { ref } from 'vue'
import BaseDropdown from '../ui/BaseDropdown.vue'
import type { Leilao } from '@renderer/types/leilao'

const props = defineProps<{
  leiloes: Leilao[]
}>()

const emit = defineEmits<{
  (e: 'editar', leilao: Leilao): void
  (e: 'excluir', leilao: Leilao): void
  (e: 'animais', leilao: Leilao): void
}>()

const showConfirmDelete = ref<string | null>(null)
const confirmacaoTexto = ref('')

function formatarDataBR(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function getDropdownItems(leilao: Leilao) {
  return [
    {
      label: 'Gerenciar Animais',
      icon: 'fa-horse-head',
      action: () => emit('animais', leilao)
    },
    {
      label: 'Editar Evento',
      icon: 'fa-edit',
      action: () => emit('editar', leilao)
    },
    {
      label: 'Excluir evento',
      icon: 'fa-trash',
      color: 'danger' as const,
      action: () => {
        showConfirmDelete.value = leilao.id
        confirmacaoTexto.value = ''
      }
    }
  ]
}

function confirmarExclusao(leilao: Leilao) {
  emit('excluir', leilao)
  showConfirmDelete.value = null
  confirmacaoTexto.value = ''
}

function cancelarExclusao() {
  showConfirmDelete.value = null
  confirmacaoTexto.value = ''
}
</script>

<template>
  <div class="border border-gray-200 rounded-lg overflow-visible bg-white shadow-md">
    <!-- Cabeçalho da Tabela -->
    <div
      class="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2.5 grid grid-cols-12 text-xs md:text-sm font-semibold"
    >
      <div class="col-span-2">DATA</div>
      <div class="col-span-6">NOME DO EVENTO</div>
      <div class="col-span-2 text-center">ANIMAIS</div>
      <div class="col-span-2 text-center">AÇÕES</div>
    </div>

    <!-- Linhas da Tabela -->
    <div v-if="props.leiloes.length === 0" class="px-4 py-8 md:py-10 text-center text-gray-500">
      <p class="text-sm md:text-base">Nenhum evento encontrado</p>
    </div>

    <div v-else class="overflow-visible">
      <div
        v-for="l in props.leiloes"
        :key="l.id"
        class="px-4 py-2.5 grid grid-cols-12 items-center border-t border-gray-100 hover:bg-blue-50 transition-colors relative"
      >
        <!-- Data -->
        <div class="col-span-2">
          <span
            class="inline-flex px-2 py-1 rounded-lg bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700"
          >
            {{ formatarDataBR(l.data) }}
          </span>
        </div>

        <!-- Nome do Evento -->
        <div class="col-span-6">
          <div class="font-semibold text-gray-900 text-sm">{{ l.titulo_evento }}</div>
          <div class="text-xs text-gray-500 mt-0.5">
            Mult: <span class="font-medium">{{ l.multiplicador }}</span>
            <span v-if="l.usa_dolar" class="ml-2">• Cot: {{ l.cotacao }}</span>
          </div>
        </div>

        <!-- Animais -->
        <div class="col-span-2 text-center">
          <span
            class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 border border-green-200 text-xs font-medium text-green-700"
          >
            <i class="fas fa-horse-head text-xs" />
            0
          </span>
        </div>

        <!-- Ações -->
        <div class="col-span-2 flex justify-center">
          <BaseDropdown :items="getDropdownItems(l)" label="Ações" />
        </div>
      </div>
    </div>

    <!-- Rodapé com informações -->
    <div class="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-600">
      Mostrando {{ props.leiloes.length }} de {{ props.leiloes.length }} evento(s)
    </div>
  </div>

  <!-- Modal de Confirmação de Exclusão -->
  <div v-if="showConfirmDelete" class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/50" @click="cancelarExclusao"></div>
    <div class="absolute inset-0 flex items-center justify-center p-4">
      <div class="w-full max-w-md bg-white rounded-lg shadow-xl border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="font-bold text-lg text-gray-900">Confirmar exclusão</h3>
        </div>

        <div class="px-6 py-4 space-y-4">
          <p class="text-gray-700 text-sm">Tem certeza que deseja apagar esse evento?</p>

          <p class="text-sm text-red-600 font-medium">
            ⚠️ Ao apagar este evento, <span class="font-semibold">todos os animais</span> dele
            também serão excluídos e <span class="font-semibold">não haverá como recuperar</span>.
          </p>

          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-2">
              Digite <span class="font-bold text-red-600">EXCLUIR</span> para confirmar
            </label>

            <input
              v-model="confirmacaoTexto"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Digite EXCLUIR"
            />
          </div>
        </div>

        <div
          class="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end gap-3"
        >
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-100 transition-colors"
            @click="cancelarExclusao"
          >
            Cancelar
          </button>

          <button
            type="button"
            :disabled="confirmacaoTexto !== 'EXCLUIR'"
            class="px-4 py-2 rounded-lg bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            @click="confirmarExclusao(leiloes.find((l) => l.id === showConfirmDelete)!)"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
