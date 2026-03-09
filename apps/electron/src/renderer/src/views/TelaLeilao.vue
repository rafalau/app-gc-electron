<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const leilaoId = route.params.id as string
</script>

<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold">Leilão</h1>
    <div class="text-gray-500 mt-2">ID: {{ leilaoId }}</div>

    <div class="mt-6 border rounded-2xl p-6 bg-white">
      <div class="font-semibold">Animais</div>
      <div class="text-gray-500 mt-2">Próxima etapa: CRUD de animais para este leilão.</div>
    </div>
  </div>
</template>
