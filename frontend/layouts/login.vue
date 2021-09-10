<template>
  <div class="container">
    <Nuxt/>
    <Alert/>
  </div>
</template>

<script>
import Alert from '~/components/popUp/alert'
export default {
  components: {
    Alert,
  },
  mounted() {
    window.addEventListener('beforeinstallprompt', event => {
      this.$store.dispatch('setBeforeInstallPrompt', event)
    })
  }
}
</script>

<style scoped>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
}
</style>
