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
  <Transition name="modal-fade" appear>
    <div v-if="aberto" class="fixed inset-0 z-50">
      <!-- Overlay -->
      <div class="absolute inset-0 bg-slate-950/45 backdrop-blur-[5px]" @click="emit('fechar')"></div>

      <!-- Modal -->
      <div class="absolute inset-0 flex items-center justify-center p-4">
        <Transition name="modal-panel" appear>
          <div
            v-if="aberto"
            class="w-full max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
          >
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
        </Transition>
      </div>
    </div>
  </Transition>
 </template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 220ms ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-panel-enter-active,
.modal-panel-leave-active {
  transition:
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms ease,
    filter 260ms ease;
}

.modal-panel-enter-from,
.modal-panel-leave-to {
  opacity: 0;
  transform: translateY(18px) scale(0.98);
  filter: blur(10px);
}
</style>
