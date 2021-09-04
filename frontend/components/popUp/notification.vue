<template>
  <PopUp
    title="One more thing"
    icon="fa-envelope"
    @close="close()"
    :buttons="buttons"
  >
    <p>Giving permission for this app to show notifications will <b>greatly</b> improve your exprecience as a user.</p>
    <p><b>We won't send you any annoying messages.</b></p>
    <p>You will receive notifications, when e.g. one of your friends wants to talk to you.</p>
  </PopUp>
</template>

<script>
import PopUp from '~/components/popUp/popUp'

export default {
  data() {
    return {
      buttons: [
        {
          text: 'Close',
          action: () => this.close()
        }
      ]
    }
  },
  methods: {
    close() {
      this.$store.dispatch('popUp/close', 'notification')
      Notification.requestPermission()
    }
  },
  components: {
    PopUp
  }
}
</script>

<style scoped>
p {
  margin: 10px;
}
p:last-child {
  margin-bottom: 15px;
}
</style>