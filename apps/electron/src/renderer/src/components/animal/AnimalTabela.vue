<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseDropdown from '../ui/BaseDropdown.vue'
import type { Animal } from '@renderer/types/animal'
import type { LayoutInformacoesAnimais } from '@renderer/composables/useAnimais'
import {
  formatarInformacoesParaExibicao,
  parseInformacoesAgregadas
} from '@renderer/utils/animalInformacoes'

const props = defineProps<{
  animais: Animal[]
  layoutModo: LayoutInformacoesAnimais
  excluindoAnimalId?: string | null
}>()

const emit = defineEmits<{
  (e: 'editar', animal: Animal): void
  (e: 'excluir', animal: Animal): void
}>()

const showConfirmDelete = ref<string | null>(null)
const animalParaExcluir = computed(
  () => props.animais.find((animal) => animal.id === showConfirmDelete.value) ?? null
)

function getDropdownItems(animal: Animal) {
  return [
    {
      label: 'Editar animal',
      icon: 'fa-edit',
      action: () => emit('editar', animal)
    },
    {
      label: 'Excluir animal',
      icon: 'fa-trash',
      color: 'danger' as const,
      action: () => {
        showConfirmDelete.value = animal.id
      }
    }
  ]
}

function confirmarExclusao(animal: Animal) {
  emit('excluir', animal)
  showConfirmDelete.value = null
}

function cancelarExclusao() {
  showConfirmDelete.value = null
}

function getInformacoesTexto(animal: Animal) {
  if (animal.categoria === 'COBERTURAS') {
    return animal.condicoes_cobertura.join(' • ') || 'Sem condições'
  }

  return formatarInformacoesParaExibicao(animal.informacoes) || 'Sem informações'
}

function getCampoSeparado(
  animal: Animal,
  campo: 'sexo' | 'nascimento'
) {
  if (animal[campo]) return animal[campo]
  return parseInformacoesAgregadas(animal.informacoes)[campo] || '—'
}
</script>

<template>
  <div class="mb-20 border border-slate-200 rounded-2xl overflow-visible bg-white shadow-sm">
    <div
      v-if="layoutModo === 'AGREGADAS'"
      class="hidden md:grid items-center gap-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-3 text-xs font-semibold tracking-wide"
      style="grid-template-columns: 88px 132px minmax(320px, 1.8fr) 92px"
    >
      <div class="text-center">LOTE</div>
      <div>CATEGORIA</div>
      <div>NOME</div>
      <div class="text-center">AÇÕES</div>
    </div>

    <div
      v-else
      class="hidden md:grid items-center gap-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-3 text-xs font-semibold tracking-wide"
      style="grid-template-columns: 88px 132px minmax(260px, 1.7fr) 100px 120px 92px"
    >
      <div class="text-center">LOTE</div>
      <div>CATEGORIA</div>
      <div>NOME</div>
      <div class="text-center">SEXO</div>
      <div class="text-center">NASCIMENTO</div>
      <div class="text-center">AÇÕES</div>
    </div>

    <div v-if="props.animais.length === 0" class="px-4 py-10 text-center text-gray-500">
      <p class="text-sm md:text-base">Nenhum animal cadastrado neste leilão</p>
    </div>

    <TransitionGroup v-else name="animal-list" tag="div" class="overflow-visible">
      <div
        v-for="animal in props.animais"
        :key="animal.id"
        class="border-t border-slate-100 transition-colors md:grid md:items-center md:gap-4 md:px-5 md:py-3.5"
        :class="
          animal.id === props.excluindoAnimalId
            ? 'bg-rose-50/90 ring-1 ring-inset ring-rose-200 opacity-55 saturate-75 scale-[0.992]'
            : 'hover:bg-slate-50'
        "
        :style="
          layoutModo === 'AGREGADAS'
            ? 'grid-template-columns: 88px 132px minmax(320px, 1.8fr) 92px'
            : 'grid-template-columns: 88px 132px minmax(260px, 1.7fr) 100px 120px 92px'
        "
      >
        <div class="px-4 pt-4 md:px-0 md:pt-0 md:text-center">
          <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">
            Lote
          </div>
          <span class="font-semibold text-slate-900 text-sm md:text-[15px]">{{ animal.lote }}</span>
        </div>

        <template v-if="layoutModo === 'AGREGADAS'">
          <div class="px-4 pt-3 md:px-0 md:pt-0 min-w-0">
            <div
              class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden"
            >
              Categoria
            </div>
            <span
              class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
              :class="
                animal.categoria === 'COBERTURAS'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              "
            >
              {{ animal.categoria }}
            </span>
          </div>

          <div class="px-4 pt-3 md:px-0 md:pt-0 min-w-0">
            <div
              class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden"
            >
              Nome
            </div>
            <div class="font-semibold text-slate-900 text-sm md:text-[15px] break-words">
              {{ animal.nome }}
            </div>
            <div
              class="mt-1 text-xs leading-5 text-slate-500 break-words"
              :title="getInformacoesTexto(animal)"
            >
              {{ getInformacoesTexto(animal) }}
            </div>
          </div>
        </template>

        <template v-else>
          <div class="px-4 pt-3 md:px-0 md:pt-0 min-w-0">
            <div
              class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden"
            >
              Categoria
            </div>
            <span
              class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
              :class="
                animal.categoria === 'COBERTURAS'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              "
            >
              {{ animal.categoria }}
            </span>
          </div>

          <div class="px-4 pt-3 md:px-0 md:pt-0 min-w-0">
            <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">
              Nome
            </div>
            <div class="font-semibold text-slate-900 text-sm md:text-[15px] break-words">
              {{ animal.nome }}
            </div>
          </div>

          <div class="px-4 pt-3 md:px-0 md:pt-0 md:text-center">
            <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">
              Sexo
            </div>
            <div class="text-sm text-slate-700 break-words">{{ getCampoSeparado(animal, 'sexo') }}</div>
          </div>

          <div class="px-4 pt-3 md:px-0 md:pt-0 md:text-center">
            <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">
              Nascimento
            </div>
            <div class="text-sm text-slate-700 break-words">
              {{ getCampoSeparado(animal, 'nascimento') }}
            </div>
          </div>
        </template>

        <div class="px-4 py-4 md:px-0 md:py-0 flex justify-end md:justify-center">
          <BaseDropdown :items="getDropdownItems(animal)" label="Ações" />
        </div>
      </div>
    </TransitionGroup>

    <div class="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-600">
      Mostrando {{ props.animais.length }} animal(is)
    </div>
  </div>

  <div v-if="showConfirmDelete" class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/50" @click="cancelarExclusao"></div>
    <div class="absolute inset-0 flex items-center justify-center p-4">
      <div class="w-full max-w-md bg-white rounded-lg shadow-xl border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="font-bold text-lg text-gray-900">Confirmar exclusão</h3>
        </div>

        <div class="px-6 py-4 space-y-4">
          <p class="text-gray-700 text-sm">
            Tem certeza que deseja apagar o animal
            <span class="font-semibold text-gray-900">{{ animalParaExcluir?.nome }}</span
            >?
          </p>
          <p v-if="animalParaExcluir" class="text-xs text-gray-500">
            Lote {{ animalParaExcluir.lote }}
          </p>
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
            class="px-4 py-2 rounded-lg bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-colors"
            @click="animalParaExcluir && confirmarExclusao(animalParaExcluir)"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animal-list-move,
.animal-list-enter-active,
.animal-list-leave-active {
  transition: all 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.animal-list-enter-from {
  opacity: 0;
  transform: translateY(14px);
}

.animal-list-leave-active {
  position: relative;
  z-index: 0;
}

.animal-list-leave-to {
  opacity: 0;
  transform: translateX(28px) scale(0.98);
  filter: blur(8px);
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
