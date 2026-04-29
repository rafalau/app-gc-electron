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
    class="px-3 py-1.5 rounded-lg font-medium text-sm border transition-all duration-200 ease-out shadow-md hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-md disabled:transform-none disabled:shadow-md"
    :class="{
      'bg-blue-600 text-white border-blue-600 hover:bg-blue-700': variante === 'primario',
      'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:border-slate-500':
        variante === 'secundario',
      'bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 dark:bg-slate-900 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-950':
        variante === 'perigo',
      'bg-green-600 text-white border-green-600 hover:bg-green-700': variante === 'sucesso',
      'opacity-60 cursor-not-allowed': disabled
    }"
  >
    <slot />
  </button>
</template>
