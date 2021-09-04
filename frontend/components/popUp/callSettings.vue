<template>
  <PopUp
    title="Settings"
    icon="fa-cog"
    :buttons="buttons"
    @close="$store.dispatch('popUp/close', 'callSettings')"
  >
    <div class="settings">
      <h3>Video:</h3>
      <div class="video">
        <p for="fps">Max fps. ({{constraints.frameRate}})</p>
        1 <input v-model="constraints.frameRate" id="fps" type="range" min="1" max="60"> 60

        <p for="quality">Max quality</p>
        <input type="radio" id="1080" :value="1080" v-model="constraints.height">
        <label for="1080">1080p</label>
        <input type="radio" id="720" :value="720" v-model="constraints.height">
        <label for="720">720p</label>
        <input type="radio" id="480" :value="480" v-model="constraints.height">
        <label for="480">480p</label>
        <input type="radio" id="360" :value="360" v-model="constraints.height">
        <label for="360">360p</label>
      </div>

      <h3>Sources</h3>
      <div class="sources">
        <div v-if="sources.audio.length">
          <label for="microphone">Microphone</label>
          <select id="microphone" v-model="device.audio">
            <option v-for="device in sources.audio" :key="device.deviceId" :value="device.deviceId">{{device.label}}</option>
          </select>
        </div>

        <div v-if="sources.video.length">
          <label for="camera">Camera</label>
          <select id="camera" v-model="device.video">
            <option v-for="device in sources.video" :key="device.deviceId" :value="device.deviceId">{{device.label}}</option>
          </select>
        </div>
      </div>
    </div>
  </PopUp>
</template>

<script>
import PopUp from '~/components/popUp/popUp'

export default {
  props: {
    sources: Object,
  },
  data() {
    return {
      constraints: {
        frameRate: this.$store.getters.call.constraints.video.frameRate.max,
        height: this.$store.getters.call.constraints.video.height.max,
        echoCancellation: this.$store.getters.call.constraints.audio.echoCancellation,
      },
      device: {
        audio: this.$store.getters.call.constraints.audio.deviceId,
        video: this.$store.getters.call.constraints.video.deviceId,
      },
      buttons: [
        {
          text: 'Cancel',
          action: () => this.$store.dispatch('popUp/close', 'callSettings')
        },
        {
          text: 'Set',
          action: this.setConstraints
        },
      ]
    }
  },
  created() {
    let audioTrack = this.$store.getters.call.stream.getAudioTracks()[0]
    let videoTrack = this.$store.getters.call.stream.getVideoTracks()[0]

    if(audioTrack)
      this.device.audio = audioTrack.getSettings().deviceId

    if(videoTrack)
      this.device.video = videoTrack.getSettings().deviceId
  },
  methods: {
    setConstraints() {
      let constraints = {
        video: {
          height: { max: this.constraints.height },
          frameRate: { max: this.constraints.frameRate },
        },
        audio: {
          echoCancellation: this.constraints.echoCancellation,
        }
      }

      if(this.device.video && !this.device.video.startsWith('screen:')) constraints.video.deviceId = this.device.video
      if(this.device.audio) constraints.audio.deviceId = this.device.audio

      this.$store.dispatch('call/setConstraints', {constraints})
      this.$store.dispatch('popUp/close', 'callSettings')
    }
  },
  components: {
    PopUp
  }
}
</script>

<style scoped>
.settings {
  padding: 0 20px;
  margin: 10px 0;
}
h3 {
  font-size: 20px;
  margin-bottom: 10px;
}
.video {
  margin: 0 0 20px 20px;
}
.video p {
  margin: 10px 0 3px;
}
.sources label {
  margin-left: 20px;
}
.sources select {
  border-radius: 5px;
  background: var(--white);
}
</style>