<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import BaseButton from '../ui/BaseButton.vue'
import type {
  ApiAuctionOption,
  ApiImportProviderOption
} from '@renderer/types/importacao'

const props = defineProps<{
  aberto: boolean
  providers: ApiImportProviderOption[]
  providerId: string
  leiloes: ApiAuctionOption[]
  loading: boolean
  importing: boolean
  selectedAuctionId: number | null
  erro: string
}>()

const emit = defineEmits<{
  (e: 'fechar'): void
  (e: 'select-provider', providerId: string): void
  (e: 'select-auction', auctionId: number | null): void
  (e: 'importar'): void
}>()

const selectedAuction = computed(
  () => props.leiloes.find((auction) => auction.id === props.selectedAuctionId) ?? null
)
</script>

<template>
  <BaseModal :aberto="aberto" titulo="Importar API" @fechar="emit('fechar')">
    <div class="space-y-5">
      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Selecione a origem da API e depois o leilão ativo para importar os animais.
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Origem da API
          </label>
          <div class="relative">
            <select
              class="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              :disabled="loading || importing"
              :value="providerId"
              @change="
                emit(
                  'select-provider',
                  ($event.target as HTMLSelectElement).value
                )
              "
            >
              <option v-for="provider in providers" :key="provider.id" :value="provider.id">
                {{ provider.nome }}
              </option>
            </select>
            <i
              class="fas fa-chevron-down pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400"
            />
          </div>
        </div>

        <div>
          <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Leilão ativo
          </label>
          <div class="relative">
            <select
              class="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              :disabled="loading || importing"
              :value="selectedAuctionId ?? ''"
              @change="
                emit(
                  'select-auction',
                  ($event.target as HTMLSelectElement).value
                    ? Number(($event.target as HTMLSelectElement).value)
                    : null
                )
              "
            >
              <option value="">Selecione um leilão</option>
              <option v-for="auction in leiloes" :key="auction.id" :value="auction.id">
                {{ auction.titulo }}
              </option>
            </select>
            <i
              class="fas fa-chevron-down pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400"
            />
          </div>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div class="text-xs uppercase tracking-[0.24em] text-slate-500">Animais</div>
          <div class="mt-2 text-2xl font-semibold text-slate-900">
            {{ selectedAuction?.totalAnimais ?? 0 }}
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div class="text-xs uppercase tracking-[0.24em] text-slate-500">Data</div>
          <div class="mt-2 text-base font-semibold text-slate-900">
            {{ selectedAuction?.dataHora || 'Sem data informada' }}
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
        :disabled="loading || importing || !selectedAuctionId"
        @click="emit('importar')"
      >
        {{ importing ? 'Importando...' : 'Importar' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
