<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface DropdownItem {
  label: string
  icon?: string
  color?: 'default' | 'danger'
  action: () => void
}

defineProps<{
  items: DropdownItem[]
  label?: string
}>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLDivElement>()

function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

function handleItemClick(item: DropdownItem) {
  item.action()
  isOpen.value = false
}

function getColorClass(color?: 'default' | 'danger') {
  return color === 'danger' ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-100'
}
</script>

<template>
  <div ref="dropdownRef" class="relative inline-block">
    <button
      type="button"
      class="px-2.5 py-1.5 text-xs font-medium text-white bg-gray-600 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-sm hover:shadow-md"
      @click="isOpen = !isOpen"
    >
      <i class="fas fa-cog text-xs" />
      {{ label || 'Ações' }}
      <i :class="['fas text-xs', isOpen ? 'fa-chevron-up' : 'fa-chevron-down']" />
    </button>

    <Transition name="dropdown-pop">
      <div
        v-if="isOpen"
        class="absolute right-0 mt-1 w-56 origin-top-right bg-white border border-gray-200 rounded-lg shadow-xl z-50"
      >
        <button
          v-for="(item, index) in items"
          :key="index"
          type="button"
          :class="[
            'w-full text-left px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2',
            getColorClass(item.color),
            index < items.length - 1 ? 'border-b border-gray-100' : ''
          ]"
          @click="handleItemClick(item)"
        >
          <i v-if="item.icon" :class="['fas text-sm', item.icon]" />
          {{ item.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dropdown-pop-enter-active,
.dropdown-pop-leave-active {
  transition:
    transform 180ms ease,
    opacity 160ms ease;
}

.dropdown-pop-enter-from,
.dropdown-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
