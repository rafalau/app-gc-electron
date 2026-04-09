<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BaseButton from '@renderer/components/ui/BaseButton.vue'
import { applyUppercaseInput } from '@renderer/utils/uppercaseInput'
import type { ApiImportProviderConfig } from '@renderer/types/importacao'

const searchParams = new URLSearchParams(window.location.search)
const leilaoId = searchParams.get('leilaoId') ?? ''
const baseUrl = searchParams.get('baseUrl') ?? ''

const carregando = ref(true)
const salvando = ref(false)
const erro = ref('')
const apiProviders = ref<ApiImportProviderConfig[]>([])

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, init)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Falha HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    const [_, providers] = await Promise.all([
      fetchJson<{ modo: 'AGREGADAS' | 'SEPARADAS'; incluirRacaNasImportacoes: boolean }>(
        `/sync/layout/${encodeURIComponent(leilaoId)}`
      ),
      fetchJson<ApiImportProviderConfig[]>('/sync/config/api-providers')
    ])

    apiProviders.value = Array.isArray(providers) ? providers : []
    document.title = 'Configurações de API'
  } catch (errorAtual) {
    erro.value = (errorAtual as Error).message
  } finally {
    carregando.value = false
  }
}

function adicionarApiProvider() {
  apiProviders.value = [
    ...apiProviders.value,
    {
      id: `api-${Date.now()}`,
      nome: '',
      url: ''
    }
  ]
}

function atualizarApiProvider(index: number, campo: 'nome' | 'url', valor: string) {
  apiProviders.value = apiProviders.value.map((provider, providerIndex) =>
    providerIndex === index ? { ...provider, [campo]: valor } : provider
  )
}

function removerApiProvider(index: number) {
  apiProviders.value = apiProviders.value.filter((_, providerIndex) => providerIndex !== index)
}

function moverApiProvider(index: number, direction: 'up' | 'down') {
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= apiProviders.value.length) return

  const next = [...apiProviders.value]
  const [item] = next.splice(index, 1)
  next.splice(targetIndex, 0, item)
  apiProviders.value = next
}

async function salvar() {
  erro.value = ''
  salvando.value = true

  try {
    await Promise.all([
      fetchJson('/sync/config/api-providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiProviders.value)
      }),
      fetchJson(`/sync/layout/${encodeURIComponent(leilaoId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: 'SEPARADAS',
          incluirRacaNasImportacoes: true
        })
      })
    ])
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
    <div class="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white">
        <div class="text-lg font-bold">Configurações de API</div>
      </div>

      <div class="px-6 py-6">
        <div v-if="erro" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {{ erro }}
        </div>

        <div v-if="carregando" class="text-sm text-slate-500">Carregando...</div>

        <div v-else class="space-y-6">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-semibold text-slate-900">Configurações de APIs</div>
                <div class="text-xs text-slate-500">Ordem e endpoints usados na importação remota.</div>
              </div>
              <BaseButton variante="primario" @click="adicionarApiProvider">Adicionar</BaseButton>
            </div>

            <div v-if="apiProviders.length === 0" class="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
              Nenhum provedor configurado.
            </div>

            <div v-else class="mt-4 space-y-3">
              <div
                v-for="(provider, index) in apiProviders"
                :key="provider.id"
                class="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div class="grid grid-cols-12 gap-3">
                  <div class="col-span-12 md:col-span-4">
                    <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Nome
                    </label>
                    <input
                      :value="provider.nome"
                      class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      type="text"
                      @input="applyUppercaseInput($event, (value) => atualizarApiProvider(index, 'nome', value))"
                    />
                  </div>

                  <div class="col-span-12 md:col-span-8">
                    <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      URL
                    </label>
                    <input
                      :value="provider.url"
                      class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      type="text"
                      @input="atualizarApiProvider(index, 'url', ($event.target as HTMLInputElement).value)"
                    />
                  </div>
                </div>

                <div class="mt-3 flex justify-end gap-2">
                  <BaseButton :disabled="index === 0" @click="moverApiProvider(index, 'up')">Subir</BaseButton>
                  <BaseButton :disabled="index === apiProviders.length - 1" @click="moverApiProvider(index, 'down')">
                    Descer
                  </BaseButton>
                  <BaseButton variante="perigo" @click="removerApiProvider(index)">Remover</BaseButton>
                </div>
              </div>
            </div>
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
