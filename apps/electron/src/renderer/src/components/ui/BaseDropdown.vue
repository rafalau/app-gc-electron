<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface DropdownItem {
  label: string
  icon?: string
  color?: 'default' | 'danger'
  disabled?: boolean
  action: () => void
}

defineProps<{
  items: DropdownItem[]
  label?: string
  variante?: 'primario' | 'secundario' | 'sucesso'
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
  if (item.disabled) return
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
      class="px-3 py-1.5 rounded-lg font-medium text-sm border transition-all duration-200 ease-out shadow-md hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-md flex items-center gap-1.5 whitespace-nowrap"
      :class="{
        'bg-blue-600 text-white border-blue-600 hover:bg-blue-700': variante === 'primario',
        'bg-gray-600 text-white border-gray-700 hover:bg-gray-700':
          !variante || variante === 'secundario',
        'bg-green-600 text-white border-green-600 hover:bg-green-700': variante === 'sucesso'
      }"
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
          :disabled="item.disabled"
          :class="[
            'w-full text-left px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2',
            getColorClass(item.color),
            item.disabled ? 'cursor-not-allowed opacity-50 hover:bg-white' : '',
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
