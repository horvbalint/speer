<template>
  <div class="confirm-popup">
    <h1>Speer</h1>
    <p>Checking confirmation success</p>
    <i class="fas fa-spinner fa-pulse"/>
  </div>
</template>

<script>
export default {
  layout: 'login',
  data() {
    return {
      confirmStart: 0,
    }
  },
  mounted() {
    this.confirmStart = Date.now()

    this.$axios.$post(`/confirm/${this.$route.params.token}`)
      .then( () => {
        let delta = Date.now() - this.confirmStart

        setTimeout( () => {
          successBox("Email confirmed!", "You can now log in")
          this.$router.push('/login')
        }, Math.max(1500 - delta, 0) )
      })
      .catch( () => {
        let delta = Date.now() - this.confirmStart

        setTimeout( () => {
          errorBox("Confirmation failed!", "Please try again")
          this.$router.push('/login')
        }, Math.max(1500 - delta, 0) )
      })
  }
}
</script>

<style scoped>
.confirm-popup {
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