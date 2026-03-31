<script setup lang="ts">
import BaseModal from '../ui/BaseModal.vue'
import BaseButton from '../ui/BaseButton.vue'
import type { ImportSummary } from '@renderer/types/importacao'

defineProps<{
  aberto: boolean
  resumo: ImportSummary | null
}>()

const emit = defineEmits<{
  (e: 'fechar'): void
}>()
</script>

<template>
  <BaseModal :aberto="aberto" titulo="Resumo da Importação" @fechar="emit('fechar')">
    <div v-if="resumo" class="space-y-5">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div
          class="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
        >
          <div class="truncate text-[11px] uppercase tracking-[0.16em] text-slate-500">Lidas</div>
          <div class="mt-2 text-2xl font-semibold text-slate-900">{{ resumo.totalRead }}</div>
        </div>
        <div
          class="min-w-0 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          <div class="truncate text-[11px] uppercase tracking-[0.16em] text-emerald-600">
            Importadas
          </div>
          <div class="mt-2 text-2xl font-semibold text-emerald-900">{{ resumo.imported }}</div>
        </div>
        <div
          class="min-w-0 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700"
        >
          <div class="truncate text-[11px] uppercase tracking-[0.16em] text-blue-600">
            Atualizadas
          </div>
          <div class="mt-2 text-2xl font-semibold text-blue-900">{{ resumo.updated }}</div>
        </div>
        <div
          class="min-w-0 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700"
        >
          <div class="truncate text-[11px] uppercase tracking-[0.16em] text-amber-600">
            Ignoradas
          </div>
          <div class="mt-2 text-2xl font-semibold text-amber-900">{{ resumo.skipped }}</div>
        </div>
        <div
          class="min-w-0 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <div class="truncate text-[11px] uppercase tracking-[0.16em] text-rose-600">
            Inválidas
          </div>
          <div class="mt-2 text-2xl font-semibold text-rose-900">{{ resumo.invalid }}</div>
        </div>
      </div>

      <div
        v-if="resumo.errors.length"
        class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
      >
        <div class="font-semibold mb-2">Ocorrências</div>
        <ul class="space-y-2">
          <li
            v-for="erro in resumo.errors"
            :key="erro"
            class="break-words rounded-xl bg-white/70 px-3 py-2 leading-5"
          >
            {{ erro }}
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <BaseButton variante="primario" @click="emit('fechar')">Fechar</BaseButton>
    </template>
  </BaseModal>
</template>
