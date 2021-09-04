<template>
  <PopUp
    :title="`${$store.state.popUp.ping.username} is offline!`"
    icon="fa-envelope"
    @close="$store.dispatch('popUp/close', 'ping')"
    :buttons="buttons"
  >
    <p>We can try to notify {{$store.state.popUp.ping.username}} by sending a notification.</p>
    <input id="message" v-model="pingMessage" :placeholder="`${$store.state.user.username} needs you online`" maxlength="50" autocomplete="off">
  </PopUp>
</template>

<script>
import PopUp from '~/components/popUp/popUp'

export default {
  data() {
    return {
      pingMessage: '',
      buttons: [
        {
          text: 'Cancel',
          action: () => {
            this.pingMessage = ''
            this.$store.dispatch('popUp/close', 'ping')
          }
        },
        {
          text: 'Notify!',
          action: () => this.ping()
        }
      ]
    }
  },
  methods: {
    ping() {
      this.$axios.$post(`/ping`, {
        id: this.$store.state.popUp.ping._id,
        message: this.pingMessage.slice(0, 50)
      })
        .then( success => {
          if(!success)
            warningBox('Oh oh!', `${this.$store.state.popUp.ping.username} has no notificaiton device configured`)
        })
        .catch( err => {
          console.error(err)
          errorBox(`Error!`, `Failed to ping ${this.$store.state.popUp.ping.username}`)
        })
        .finally( () => this.$store.dispatch('popUp/close', 'ping') )
    }
  },
  components: {
    PopUp
  }
}
</script>

<style scoped>
label {
  display: block;
}
input {
  display: block;
  width: 100%;
  height: 40px;
  border: none;
  border-radius: 50px;
  padding: 5px 10px;
  font-size: 14px;
  margin-top: 10px;
}
</style>