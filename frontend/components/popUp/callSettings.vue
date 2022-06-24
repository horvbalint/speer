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
        <p for="fps">Max fps. ({{inputConstraints.frameRate}})</p>
        1 <input v-model="inputConstraints.frameRate" id="fps" type="range" min="1" max="60"> 60

        <p for="quality">Max quality</p>
        <input type="radio" id="1080" :value="1080" v-model="inputConstraints.height">
        <label for="1080">1080p</label>
        <input type="radio" id="720" :value="720" v-model="inputConstraints.height">
        <label for="720">720p</label>
        <input type="radio" id="480" :value="480" v-model="inputConstraints.height">
        <label for="480">480p</label>
        <input type="radio" id="360" :value="360" v-model="inputConstraints.height">
        <label for="360">360p</label>
      </div>

      <h3>Input devices</h3>
      <div class="sources">
        <div v-if="sources.audio.input.length" class="device-selector-wrapper">
          <label for="microphone">Microphone</label>
          <select id="microphone" v-model="devices.audio.input">
            <option v-for="device in sources.audio.input" :key="device.deviceId" :value="device.deviceId">{{device.label}}</option>
          </select>
        </div>

        <div v-if="sources.video.input.length" class="device-selector-wrapper">
          <label for="camera">Camera</label>
          <select id="camera" v-model="devices.video.input">
            <option v-for="device in sources.video.input" :key="device.deviceId" :value="device.deviceId">{{device.label}}</option>
          </select>
        </div>
      </div>

      <h3>Output devices</h3>
      <div class="sources">
        <div v-if="sources.audio.output.length" class="device-selector-wrapper">
          <label for="speaker">Speaker</label>
          <select id="speaker" v-model="devices.audio.output">
            <option v-for="device in sources.audio.output" :key="device.deviceId" :value="device.deviceId">{{device.label}}</option>
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
      inputConstraints: {
        frameRate: this.$store.state.call.constraints.video.input.frameRate.max,
        height: this.$store.state.call.constraints.video.input.height.max,
        echoCancellation: this.$store.state.call.constraints.audio.input.echoCancellation,
      },
      devices: {
        audio: {
          input: this.$store.state.call.constraints.audio.input.deviceId,
          output: this.$store.state.call.audioOutputDevice,
        },
        video: {
          input: this.$store.state.call.constraints.video.input.deviceId,
          output: null
        }
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
    let audioTrack = this.$store.state.call.stream.getAudioTracks()[0]
    let videoTrack = this.$store.state.call.stream.getVideoTracks()[0]

    if(audioTrack)
      this.devices.audio.input = audioTrack.getSettings().deviceId

    if(videoTrack)
      this.devices.video.input = videoTrack.getSettings().deviceId
  },
  methods: {
    setConstraints() {
      let constraints = {
        video: {
          input: {
            height: { max: this.inputConstraints.height },
            frameRate: { max: this.inputConstraints.frameRate },
          },
          output: {},
        },
        audio: {
          input: {
            echoCancellation: this.inputConstraints.echoCancellation,
          },
          output: {},
        }
      }

      if(this.devices.video.input && !this.devices.video.input.startsWith('screen:')) constraints.video.input.deviceId = this.devices.video.input
      if(this.devices.audio.input) constraints.audio.input.deviceId = this.devices.audio.input
      if(this.devices.audio.output) constraints.audio.output.deviceId = this.devices.audio.output

      this.$store.dispatch('call/setConstraints', constraints)
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
  margin: 20px 0 10px;
}
.video {
  margin-left: 20px;
}
.video p {
  margin: 10px 0 3px;
}
.sources .device-selector-wrapper {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: center;
}
.sources .device-selector-wrapper label {
  margin-left: 20px;
}
.sources .device-selector-wrapper select {
  flex: 1;
  border-radius: 5px;
  background: var(--white);
  max-width: 200px;
}
</style>