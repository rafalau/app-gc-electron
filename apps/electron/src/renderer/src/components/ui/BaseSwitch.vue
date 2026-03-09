<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()
</script>

<template>
  <div class="flex items-center gap-3">
    <button
      type="button"
      :class="[
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        modelValue ? 'bg-blue-600' : 'bg-gray-300'
      ]"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span
        :class="[
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          modelValue ? 'translate-x-6' : 'translate-x-1'
        ]"
      />
    </button>
    <label v-if="label" class="text-sm font-medium text-gray-700">{{ label }}</label>
  </div>
</template>
