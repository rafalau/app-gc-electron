<script setup lang="ts">
import { ref } from 'vue'
import BaseDropdown from '../ui/BaseDropdown.vue'
import type { Leilao } from '@renderer/types/leilao'
import { applyUppercaseInput } from '@renderer/utils/uppercaseInput'

const props = defineProps<{
  leiloes: Leilao[]
}>()

const emit = defineEmits<{
  (e: 'editar', leilao: Leilao): void
  (e: 'excluir', leilao: Leilao): void
  (e: 'animais', leilao: Leilao): void
  (e: 'operacao', leilao: Leilao): void
}>()

const showConfirmDelete = ref<string | null>(null)
const confirmacaoTexto = ref('')

function formatarDataBR(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function formatarDataHoraBR(iso?: string | null) {
  if (!iso) return ''

  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return iso

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(data)
}

function textoStatusSync(leilao: Leilao) {
  if (leilao.gc_sync_status === 'error') {
    return 'Falha'
  }

  if (leilao.gc_sync_at) {
    return formatarDataHoraBR(leilao.gc_sync_at)
  }

  return 'Pendente'
}

function partesStatusSync(leilao: Leilao) {
  if (leilao.gc_sync_status === 'error' || !leilao.gc_sync_at) {
    return {
      linha1: textoStatusSync(leilao),
      linha2: ''
    }
  }

  const formatado = formatarDataHoraBR(leilao.gc_sync_at)
  const [linha1 = formatado, linha2 = ''] = formatado.split(', ')

  return { linha1, linha2 }
}

function classeStatusSync(leilao: Leilao) {
  if (leilao.gc_sync_status === 'error') {
    return 'text-rose-600 dark:text-rose-300'
  }

  if (leilao.gc_sync_at) {
    return 'text-emerald-700 dark:text-emerald-300'
  }

  return 'text-slate-400 dark:text-slate-500'
}

function getDropdownItems(leilao: Leilao) {
  const items = [
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

  return items
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
  <div class="overflow-visible rounded-lg border border-gray-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900">
    <!-- Cabeçalho da Tabela -->
    <div
      class="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2.5 grid grid-cols-12 text-xs md:text-sm font-semibold"
    >
      <div class="col-span-2 text-center">DATA</div>
      <div class="col-span-4">NOME DO EVENTO</div>
      <div class="col-span-2 text-center">SINC. SERVIDOR</div>
      <div class="col-span-2 text-center">ANIMAIS</div>
      <div class="col-span-2 text-center">AÇÕES</div>
    </div>

    <!-- Linhas da Tabela -->
    <div v-if="props.leiloes.length === 0" class="px-4 py-8 text-center text-gray-500 dark:text-slate-400 md:py-10">
      <p class="text-sm md:text-base">Nenhum evento encontrado</p>
    </div>

    <div v-else class="overflow-visible">
      <div
        v-for="l in props.leiloes"
        :key="l.id"
        class="relative grid grid-cols-12 items-center border-t border-gray-100 px-4 py-2.5 transition-colors hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-slate-800"
      >
        <!-- Data -->
        <div class="col-span-2 flex justify-center">
          <span
            class="inline-flex rounded-lg border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {{ formatarDataBR(l.data) }}
          </span>
        </div>

        <!-- Nome do Evento -->
        <div class="col-span-4">
          <div class="text-sm font-semibold text-gray-900 dark:text-slate-100">{{ l.titulo_evento }}</div>
        </div>

        <!-- Sync -->
        <div class="col-span-2 flex justify-center">
          <div
            class="inline-flex min-w-[112px] max-w-full flex-col items-center rounded-2xl bg-slate-50 px-2.5 py-1.5 text-xs tracking-[0.02em] dark:bg-slate-800"
            :class="classeStatusSync(l)"
          >
            <span class="max-w-full truncate text-center font-medium">
              {{ partesStatusSync(l).linha1 }}
            </span>
            <span v-if="partesStatusSync(l).linha2" class="max-w-full truncate text-center opacity-80">
              {{ partesStatusSync(l).linha2 }}
            </span>
          </div>
        </div>

        <!-- Animais -->
        <div class="col-span-2 text-center">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 dark:border-green-700 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900"
            @click="emit('animais', l)"
          >
            <i class="fas fa-horse-head text-xs" />
            {{ l.total_animais }}
          </button>
        </div>

        <!-- Ações -->
        <div class="col-span-2 flex items-center justify-center gap-2">
          <button
            type="button"
            class="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 dark:border-red-800 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
            title="Modo Operação"
            @click="emit('operacao', l)"
          >
            <span class="absolute inline-flex h-full w-full animate-ping rounded-lg bg-red-300 opacity-25"></span>
            <i class="fas fa-broadcast-tower relative text-sm" />
          </button>
          <BaseDropdown :items="getDropdownItems(l)" label="Ações" />
        </div>
      </div>
    </div>

    <!-- Rodapé com informações -->
    <div class="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
      Mostrando {{ props.leiloes.length }} de {{ props.leiloes.length }} evento(s)
    </div>
  </div>

  <!-- Modal de Confirmação de Exclusão -->
  <div v-if="showConfirmDelete" class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/50" @click="cancelarExclusao"></div>
    <div class="absolute inset-0 flex items-center justify-center p-4">
      <div class="w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div class="border-b border-gray-200 px-6 py-4 dark:border-slate-700">
          <h3 class="font-bold text-lg text-gray-900">Confirmar exclusão</h3>
        </div>

        <div class="space-y-4 px-6 py-4">
          <p class="text-sm text-gray-700 dark:text-slate-200">Tem certeza que deseja apagar esse evento?</p>

          <p class="text-sm text-red-600 font-medium">
            ⚠️ Ao apagar este evento, <span class="font-semibold">todos os animais</span> dele
            também serão excluídos e <span class="font-semibold">não haverá como recuperar</span>.
          </p>

          <div>
            <label class="mb-2 block text-xs font-semibold text-gray-600 dark:text-slate-400">
              Digite <span class="font-bold text-red-600">EXCLUIR</span> para confirmar
            </label>

            <input
              v-model="confirmacaoTexto"
              type="text"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="Digite EXCLUIR"
              @input="applyUppercaseInput($event, (value) => (confirmacaoTexto = value))"
            />
          </div>
        </div>

        <div
          class="flex justify-end gap-3 rounded-b-lg border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-950"
        >
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
