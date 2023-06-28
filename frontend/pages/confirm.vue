<script setup lang="ts">
const route = useRoute()

$api(`/confirm/${route.query.token}`, { method: 'post' })
  .then(() => { navigateTo('/login') })
  .catch(err => console.error(err))
</script>

<template>
  <h1>Confirming...</h1>
</template>
