<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import LeilaoTabela from '@renderer/components/leilao/LeilaoTabela.vue'
import LeilaoModal from '@renderer/components/leilao/LeilaoModal.vue'
import BaseButton from '@renderer/components/ui/BaseButton.vue'
import { useLeiloes } from '@renderer/composables/useLeiloes'
import type { Leilao } from '@renderer/types/leilao'
import { obterModoConfig } from '@renderer/services/config.service'
import { obterConexaoOperacao } from '@renderer/services/operacao.service'
import { applyUppercaseInput } from '@renderer/utils/uppercaseInput'

const router = useRouter()
const conexaoOperacao = ref<Awaited<ReturnType<typeof obterConexaoOperacao>> | null>(null)
const copiandoIp = ref(false)
const modoAtual = ref<'HOST' | 'REMOTO' | null>(null)
const ipHostPrincipal = computed(() => {
  if (!conexaoOperacao.value || conexaoOperacao.value.modo !== 'HOST') return ''
  return conexaoOperacao.value.hostIp
})

const {
  aba,
  busca,
  leiloesFiltrados,

  modalAberto,
  modalModo,
  form,
  erroModal,
  abrirCriar,
  abrirEditar,
  fecharModal,
  salvarModal,
  excluir
} = useLeiloes()

function irAnimais(leilao: Leilao) {
  router.push(`/leilao/${leilao.id}`)
}

function irOperacao(leilao: Leilao) {
  router.push(`/operacao/${leilao.id}`)
}

async function voltarSelecaoModo() {
  if (modoAtual.value === 'REMOTO') {
    router.replace('/conexao')
  }
}

function desconectarRemoto() {
  router.replace('/conexao')
}

async function copiarIpHost() {
  if (!ipHostPrincipal.value) return
  await navigator.clipboard.writeText(ipHostPrincipal.value)
  copiandoIp.value = true
  window.setTimeout(() => {
    copiandoIp.value = false
  }, 1200)
}

onMounted(async () => {
  const modoConfig = await obterModoConfig()
  modoAtual.value = modoConfig.modo
  conexaoOperacao.value = await obterConexaoOperacao()
})
</script>

<template>
  <div class="p-4 md:p-6 lg:p-8 min-h-screen bg-blue-50">
    <div v-if="modoAtual === 'REMOTO'" class="mb-4">
      <button
        class="text-sm text-blue-700 hover:text-blue-900 font-medium"
        type="button"
        @click="voltarSelecaoModo"
      >
        ← Alterar IP do host
      </button>
    </div>

    <div
      v-if="conexaoOperacao?.modo === 'HOST' && ipHostPrincipal"
      class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-white px-4 py-3 shadow-sm"
    >
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">IP do Host</div>
        <div class="mt-1 text-lg font-bold text-slate-900">{{ ipHostPrincipal }}</div>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        @click="copiarIpHost"
      >
        <i class="fas fa-copy text-xs" />
        {{ copiandoIp ? 'Copiado' : 'Copiar IP' }}
      </button>
    </div>

    <div
      v-else-if="conexaoOperacao?.modo === 'REMOTO'"
      class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
    >
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Host conectado</div>
        <div class="mt-1 text-base font-semibold text-slate-900">{{ conexaoOperacao.hostIp }}</div>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100"
        @click="desconectarRemoto"
      >
        <i class="fas fa-plug-circle-xmark text-xs" />
        Desconectar
      </button>
    </div>

    <!-- Cabeçalho com Busca e Botão -->
    <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
      <div class="flex-1 w-full md:max-w-md relative">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          v-model="busca"
          class="w-full border bg-white border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          type="text"
          @input="applyUppercaseInput($event, (value) => (busca = value))"
        />
      </div>

      <BaseButton variante="primario" class="w-full md:w-auto" @click="abrirCriar">
        <i class="fas fa-plus mr-1" />
        Novo Evento
      </BaseButton>
    </div>

    <!-- Espaço entre busca e abas -->
    <div class="mb-3" />

    <!-- Abas -->
    <div class="flex gap-2 mb-3">
      <BaseButton :variante="aba === 'ATIVOS' ? 'primario' : 'secundario'" @click="aba = 'ATIVOS'">
        <i class="fas fa-check mr-1" />
        Ativos
      </BaseButton>

      <BaseButton
        :variante="aba === 'ARQUIVADOS' ? 'primario' : 'secundario'"
        @click="aba = 'ARQUIVADOS'"
      >
        <i class="fas fa-archive mr-1" />
        Arquivados
      </BaseButton>
    </div>

    <!-- Espaço entre abas e tabela -->
    <div class="mb-3" />

    <!-- Tabela -->
    <LeilaoTabela
      :leiloes="leiloesFiltrados"
      @editar="abrirEditar"
      @excluir="excluir"
      @animais="irAnimais"
      @operacao="irOperacao"
    />

    <!-- Modal -->
    <LeilaoModal
      :aberto="modalAberto"
      :modo="modalModo"
      :form="form"
      :erro="erroModal"
      @fechar="fecharModal"
      @salvar="salvarModal"
    />
  </div>
</template>
