<script setup lang="ts">
import { computed, ref } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

const toasts = ref<Toast[]>([])

const showToasts = computed(() => toasts.value)

function addToast(message: string, type: ToastType = 'info', duration = 3000) {
  const id = Date.now().toString()
  toasts.value.push({ id, message, type, duration })

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id)
    }, duration)
  }
}

function removeToast(id: string) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

function getIcon(type: ToastType) {
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-warning',
    info: 'fa-info-circle'
  }
  return icons[type]
}

function getColors(type: ToastType) {
  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }
  return colors[type]
}

defineExpose({
  addToast,
  removeToast
})
</script>

<template>
  <div class="fixed top-4 right-4 z-40 space-y-2">
    <transition-group name="toast" tag="div">
      <div
        v-for="toast in showToasts"
        :key="toast.id"
        :class="['flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg', getColors(toast.type)]"
      >
        <i :class="['fas', getIcon(toast.type)]" />
        <span class="text-sm font-medium">{{ toast.message }}</span>
        <button
          type="button"
          class="ml-auto text-lg leading-none opacity-70 hover:opacity-100"
          @click="removeToast(toast.id)"
        >
          ×
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
