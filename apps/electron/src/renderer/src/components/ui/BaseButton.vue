<script setup lang="ts">
withDefaults(
  defineProps<{
    variante?: 'primario' | 'secundario' | 'perigo' | 'sucesso'
    type?: 'button' | 'submit'
    disabled?: boolean
  }>(),
  {
    variante: 'secundario',
    type: 'button',
    disabled: false
  }
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-200 shadow-md hover:shadow-lg"
    :class="{
      'bg-blue-600 text-white border-blue-600 hover:bg-blue-700': variante === 'primario',
      'bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400': variante === 'secundario',
      'bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300':
        variante === 'perigo',
      'bg-green-600 text-white border-green-600 hover:bg-green-700': variante === 'sucesso',
      'opacity-60 cursor-not-allowed': disabled
    }"
  >
    <slot />
  </button>
</template>
