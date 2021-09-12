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
    window.addEventListener('beforeinstallprompt', this.saveBeforeInstallPrompt)
  },
  methods: {
    saveBeforeInstallPrompt(event) {
      this.$store.dispatch('setBeforeInstallPrompt', event)
    }
  },
  beforeDestroy() {
    window.removeEventListener('beforeinstallprompt', this.saveBeforeInstallPrompt)
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
