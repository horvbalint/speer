<script setup lang="ts">
const route = useRoute()

$api(`/cancel/${route.query.token}`, { method: 'post' })
  .then(() => { navigateTo('/login') })
  .catch(err => console.error(err))
</script>

<template>
  <h1>Canceling...</h1>
</template>
