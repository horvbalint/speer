<template>
  <div class="cancel-popup">
    <h1>Speer</h1>
    <p>Canceling registration</p>
    <i class="fas fa-spinner fa-pulse"/>
  </div>
</template>

<script>
export default {
  layout: 'login',
  data() {
    return {
      cancelStart: 0,
    }
  },
  mounted() {
    this.cancelStart = Date.now()

    this.$axios.$post(`/cancel/${this.$route.params.token}`)
      .then( () => {
        let delta = Date.now() - this.cancelStart

        setTimeout( () => {
          successBox("Registration canceled!", "You can register later anytime if you want")
          this.$router.push('/login')
        }, Math.max(1500 - delta, 0) )
      })
      .catch( () => {
        let delta = Date.now() - this.cancelStart

        setTimeout( () => {
          errorBox("Cancellation failed!", "There was an error, try again later")
          this.$router.push('/login')
        }, Math.max(1500 - delta, 0) )
      })
  }
}
</script>

<style scoped>
.cancel-popup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  background: var(--accent-color);
  padding: 20px;
  border-radius: 10px;
  width: 90%;
  max-width: 400px;
}
p {
  margin-bottom: 20px;
  font-size: 25px;
}
i {
  font-size: 30px;
  cursor: default;
}
h1 {
  text-align: center;
  font-size: 50px;
  margin-bottom: 30px;
}
</style>