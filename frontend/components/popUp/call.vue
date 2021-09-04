<template>
  <PopUp
    :title="`Incoming ${$store.state.popUp.call.properties.video ? 'video ' : ''}call`"
    icon="fas fa-phone"
    :buttons="buttons"
  >
    <div class="img" :style="{'background-image': `url('${$store.state.backendURL}/static/${$store.state.popUp.call.caller.avatar}')`}"/>
    <p>{{$store.state.popUp.call.caller.username}} is calling you.</p>
  </PopUp>
</template>

<script>
import PopUp from '~/components/popUp/popUp'

export default {
  data() {
    return {
      buttons: [
        {
          text: 'Decline',
          action: () => this.$store.dispatch('call/decline')
        },
        {
          text: 'Accept',
          action: () => this.$store.dispatch('call/accept', this.$store.state.popUp.call.caller._id)
        }
      ]
    }
  },
  created() {
    this.$store.state.callSound.currentTime = 0
    this.$store.state.callSound.play().catch(err => {})

    if(!this.$store.state.pageVisible) {
      document.title = `Incoming ${this.$store.state.popUp.call.properties.video ? 'video ' : ''}call - ${this.$store.state.popUp.call.caller.username}`

      if(Notification && Notification.permission == 'granted') {
        new Notification(`Incoming ${this.$store.state.popUp.call.properties.video ? 'video ' : ''}call`, {
          icon: '/icon.png',
          vibrate: [200, 100, 200],
          body: `${this.$store.state.popUp.call.caller.username} is calling you.`,
        })
      }
    }
  },
  beforeDestroy() {
    this.$store.state.callSound.pause()
    document.title = 'Speer'
  },
  components: {
    PopUp
  }
}
</script>

<style scoped>
.img {
  width: 100px;
  height: 100px;
  border-radius: 100%;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  border: 3px solid var(--accent-color);
  margin: 15px auto 10px;
  cursor: pointer;
  position: relative;
}
p {
  text-align: center;
  margin-bottom: 20px;
}
@media screen and (max-width: 600px) {
  .img {
    width: 130px;
    height: 130px;
  }
}
</style>