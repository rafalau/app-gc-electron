<script setup lang="ts">
import BaseModal from '../ui/BaseModal.vue'
import BaseButton from '../ui/BaseButton.vue'
import type { Animal } from '@renderer/types/animal'
import {
  formatarInformacoesParaExibicao,
  parseInformacoesAgregadas
} from '@renderer/utils/animalInformacoes'

defineProps<{
  aberto: boolean
  animais: Animal[]
}>()

const emit = defineEmits<{
  (e: 'fechar'): void
}>()

function getRaca(animal: Animal) {
  if (animal.raca) return animal.raca
  return parseInformacoesAgregadas(animal.informacoes).raca.trim()
}

function getVendedor(animal: Animal) {
  return String(animal.vendedor ?? '').trim()
}

function getCondicoesEspecificas(animal: Animal) {
  return String(animal.condicoes_pagamento_especificas ?? '').trim()
}

function getInformacoes(animal: Animal) {
  return formatarInformacoesParaExibicao(animal.informacoes)
}
</script>

<template>
  <BaseModal :aberto="aberto" titulo="Modo Conferência" @fechar="emit('fechar')">
    <div v-if="animais.length === 0" class="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
      Nenhum animal para conferir.
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="animal in animais"
        :key="animal.id"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
            Lote {{ animal.lote }}
          </div>
          <span
            class="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
            :class="
              animal.categoria === 'COBERTURAS'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            "
          >
            {{ animal.categoria }}
          </span>
        </div>

        <div class="mt-3 text-lg font-bold text-slate-900 break-words">
          {{ animal.nome }}
        </div>

        <div class="mt-4 space-y-3 text-sm text-slate-700">
          <div>
            <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {{ animal.categoria === 'COBERTURAS' ? 'Pacotes Disponíveis' : 'Informações' }}
            </div>
            <div v-if="animal.categoria === 'COBERTURAS'" class="mt-1 space-y-1.5">
              <div
                v-for="condicao in animal.condicoes_cobertura"
                :key="condicao"
                class="rounded-xl bg-slate-50 px-3 py-2 break-words"
              >
                {{ condicao }}
              </div>
              <div v-if="animal.condicoes_cobertura.length === 0" class="mt-1 text-slate-500">
                Sem condições
              </div>
            </div>
            <div v-else class="mt-1 break-words">
              {{ getInformacoes(animal) || 'Sem informações' }}
            </div>
          </div>

          <div v-if="animal.categoria === 'COBERTURAS' && getInformacoes(animal)">
            <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Informações
            </div>
            <div class="mt-1 break-words">
              {{ getInformacoes(animal) }}
            </div>
          </div>

          <div v-if="getRaca(animal)">
            <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Raça
            </div>
            <div class="mt-1 break-words">
              {{ getRaca(animal) }}
            </div>
          </div>

          <div>
            <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Genealogia
            </div>
            <div class="mt-1 break-words">
              {{ animal.genealogia || 'Sem genealogia' }}
            </div>
          </div>

          <div v-if="getCondicoesEspecificas(animal)">
            <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Condições Específicas
            </div>
            <div class="mt-1 break-words">
              {{ getCondicoesEspecificas(animal) }}
            </div>
          </div>

          <div v-if="getVendedor(animal)">
            <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Vendedor
            </div>
            <div class="mt-1 break-words">
              {{ getVendedor(animal) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <BaseButton variante="primario" @click="emit('fechar')">Fechar</BaseButton>
    </template>
  </BaseModal>
</template>
