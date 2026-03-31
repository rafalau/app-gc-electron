<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import BaseButton from '../ui/BaseButton.vue'
import type { Remate360EventOption } from '@renderer/types/importacao'

const props = defineProps<{
  aberto: boolean
  eventos: Remate360EventOption[]
  loading: boolean
  importing: boolean
  selectedEventId: number | null
  erro: string
}>()

const emit = defineEmits<{
  (e: 'fechar'): void
  (e: 'select', eventId: number | null): void
  (e: 'importar'): void
}>()

const selectedEvent = computed(
  () => props.eventos.find((event) => event.id === props.selectedEventId) ?? null
)
</script>

<template>
  <BaseModal :aberto="aberto" titulo="Importar do Remate360" @fechar="emit('fechar')">
    <div class="space-y-5">
      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Selecione um evento disponível para importar os animais direto da API.
      </div>

      <div>
        <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
          Evento disponível
        </label>
        <div class="relative">
          <select
            class="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            :disabled="loading || importing"
            :value="selectedEventId ?? ''"
            @change="
              emit(
                'select',
                ($event.target as HTMLSelectElement).value
                  ? Number(($event.target as HTMLSelectElement).value)
                  : null
              )
            "
          >
            <option value="">Selecione um evento</option>
            <option v-for="event in eventos" :key="event.id" :value="event.id">
              {{ event.titulo }}
            </option>
          </select>
          <i
            class="fas fa-chevron-down pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400"
          />
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div class="text-xs uppercase tracking-[0.24em] text-slate-500">Animais</div>
          <div class="mt-2 text-2xl font-semibold text-slate-900">
            {{ selectedEvent?.totalAnimais ?? 0 }}
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div class="text-xs uppercase tracking-[0.24em] text-slate-500">Data</div>
          <div class="mt-2 text-base font-semibold text-slate-900">
            {{ selectedEvent?.dataHora || 'Sem data informada' }}
          </div>
        </div>
      </div>

      <div
        v-if="erro"
        class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
      >
        {{ erro }}
      </div>
    </div>

    <template #footer>
      <BaseButton @click="emit('fechar')">Cancelar</BaseButton>
      <BaseButton
        variante="primario"
        :disabled="loading || importing || !selectedEventId"
        @click="emit('importar')"
      >
        {{ importing ? 'Importando...' : 'Importar' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
