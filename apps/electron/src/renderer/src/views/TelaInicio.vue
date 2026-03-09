<script setup lang="ts">
import { useRouter } from 'vue-router'
import LeilaoTabela from '@renderer/components/leilao/LeilaoTabela.vue'
import LeilaoModal from '@renderer/components/leilao/LeilaoModal.vue'
import BaseButton from '@renderer/components/ui/BaseButton.vue'
import { useLeiloes } from '@renderer/composables/useLeiloes'
import type { Leilao } from '@renderer/types/leilao'

const router = useRouter()

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
</script>

<template>
  <div class="p-4 md:p-6 lg:p-8 min-h-screen bg-blue-50">
    <!-- Cabeçalho com Busca e Botão -->
    <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
      <div class="flex-1 w-full md:max-w-md relative">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          v-model="busca"
          class="w-full border bg-white border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          type="text"
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
