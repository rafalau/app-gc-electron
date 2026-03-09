<script setup lang="ts">
defineProps<{
  aberto: boolean
  titulo: string
  headerColor?: 'blue' | 'purple'
}>()

const emit = defineEmits<{
  (e: 'fechar'): void
}>()
</script>

<template>
  <div v-if="aberto" class="fixed inset-0 z-50">
    <!-- Overlay -->
    <div class="absolute inset-0 bg-black/50" @click="emit('fechar')"></div>

    <!-- Modal -->
    <div class="absolute inset-0 flex items-center justify-center p-4">
      <div class="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <!-- Cabeçalho -->
        <div
          :class="[
            'flex items-center justify-between px-6 py-5 border-b border-gray-200 text-white',
            'bg-gradient-to-r from-blue-600 to-blue-700'
          ]"
        >
          <div class="font-bold text-lg">{{ titulo }}</div>
          <button
            class="text-blue-100 hover:text-white transition-colors text-2xl leading-none"
            @click="emit('fechar')"
          >
            ×
          </button>
        </div>

        <!-- Conteúdo -->
        <div class="px-6 py-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          <slot />
        </div>

        <!-- Rodapé -->
        <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </div>
</template>
