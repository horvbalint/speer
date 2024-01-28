<template>
  <div class="call" ref="call">
    <div v-show="!$store.getters.call.hasRemoteVideo" class="noImage">
      <img :src="`${$config.backendUrl}/static/${$store.state.call.partner.avatar}`">

      <p v-if="!$store.getters.call.remoteStream">Waiting for {{$store.state.call.partner.username}} to response...</p>
      <p v-else>{{ currentDuration }}</p>
    </div>

    <transition name="pop">
      <CallSettings v-if="$store.state.popUp.callSettings" :sources="sources"/>
    </transition>

    <video v-show="$store.getters.call.hasRemoteVideo" class="video" ref="video" autoplay></video>
    <video v-show="$store.getters.call.tracks.video.main || $store.getters.call.tracks.video.screen" class="localVideo" ref="localVideo" autoplay muted></video>
    <audio hidden ref="secondAudio" autoplay></audio>

    <i class="fas fa-cog settings-btn" @click="$store.dispatch('popUp/open', 'callSettings')"/>

    <div class="controls">
      <div>
        <i class="fas fa-phone-slash" @click="$store.dispatch('call/hangUp')"></i>
      </div>

      <div>
        <i v-if="$store.getters.call.tracks.audio.main" class="fas fa-microphone" @click="$store.dispatch('call/muteAudio')"></i>
        <i v-else class="fas fa-microphone-slash" @click="$store.dispatch('call/unmuteAudio')"></i>
      </div>

      <div>
        <i v-if="$store.getters.call.tracks.video.main" class="fas fa-video" @click="$store.dispatch('call/disableVideo')"></i>
        <i v-else class="fas fa-video-slash" @click="$store.dispatch('call/enableVideo')"></i>
      </div>

      <div v-if="canScreenShare">
        <i v-if="$store.getters.call.tracks.video.screen" class="fas fa-times" @click="$store.dispatch('call/stopScreenCapture')"></i>
        <i v-else class="fas fa-desktop" @click="$store.dispatch('call/startScreenCapture')"></i>
      </div>

      <div>
        <i v-if="!$store.state.call.fullScreen" class="fas fa-expand" @click="requestFullScreen()"></i>
        <i v-else class="fas fa-compress" @click="leaveFullScreen()"></i>
      </div>
    </div>
  </div>
</template>

<script>
import CallSettings from '../components/popUp/callSettings'

export default {
  data() {
    return {
      timeOut: null,
      currentDuration: '00:00',
      canScreenShare: false,
      sources: {
        audio: {
          input: [],
          output: []
        },
        video: {
          input: [],
          output: []
        },
      }
    }
  },
  created() {
    if(navigator.mediaDevices.getDisplayMedia) this.canScreenShare = true

    navigator.mediaDevices.enumerateDevices()
    .then( devices => {
      for(let device of devices) {
        switch(device.kind) {
          case 'audioinput':  this.sources.audio.input.push(device); break;
          case 'audiooutput': this.sources.audio.output.push(device); break;
          case 'videoinput':  this.sources.video.input.push(device); break;
        }
      }
    })
  },
  mounted() {
    if(this.$store.getters.call.stream)
      this.$refs.localVideo.srcObject = this.$store.getters.call.stream

    if(this.$store.state.call.audioOutputDevice) {
      if(this.$refs.video)
        this.$refs.video.setSinkId(this.$store.state.call.audioOutputDevice)

      if(this.$refs.secondAudio)
        this.$refs.secondAudio.setSinkId(this.$store.state.call.audioOutputDevice)
    }
  },
  methods: {
    requestFullScreen() {
      let promise = this.$refs.call.requestFullscreen ?  this.$refs.call.requestFullscreen() : this.$refs.call.webkitRequestFullscreen()

      promise.then( () => {
        this.$store.dispatch('call/setFullScreen', true)

        document.addEventListener('fullscreenchange', () => {
          if(!document.fullscreenElement)
            this.$store.dispatch('call/setFullScreen', false)
        })
      })
    },
    leaveFullScreen() {
      if (document.exitFullscreen) document.exitFullscreen()
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen()

      this.$store.dispatch('call/setFullScreen', false)
    },
    calculateCallDuration() {
      let duration = Math.floor((Date.now()-this.$store.getters.call.startTime)/1000)

      let hours = Math.floor(duration / 3600)
      let minutes = Math.floor((duration - (hours*3600)) / 60)
      let secs = duration - (hours*3600) - (minutes*60)

      let str = ''
      if(hours) str += `${String(hours).padStart(2, '0')}:`
      str += `${String(minutes).padStart(2, '0')}:`
      str += `${String(secs).padStart(2, '0')}`

      this.currentDuration = str
    }
  },
  watch: {
    '$store.getters.call.remoteStream': function() {
      if(!this.$store.getters.call.remoteStream) return

      this.timeOut = setInterval(this.calculateCallDuration, 1000)

      this.$refs.video.srcObject = this.$store.getters.call.remoteStream

      this.$store.getters.call.remoteStream.addEventListener('addtrack', ({track}) => {
        if(!this.$refs.secondAudio) return
        if(this.$store.getters.call.remoteStream.getAudioTracks().length < 2) return

        this.$refs.secondAudio.srcObject = new MediaStream([track])
      })

      this.$store.getters.call.remoteStream.addEventListener('removetrack', () => {
        if(!this.$refs.secondAudio) return

        this.$refs.secondAudio.srcObject = null
      })
    },
    '$store.getters.call.stream': function() {
      if(!this.$refs.localVideo) return

      this.$refs.localVideo.srcObject = this.$store.getters.call.stream
    },
    '$store.state.call.audioOutputDevice': function() {
      if(this.$store.state.call.audioOutputDevice) {
        if(this.$refs.video)
          this.$refs.video.setSinkId(this.$store.state.call.audioOutputDevice)

        if(this.$refs.secondAudio)
          this.$refs.secondAudio.setSinkId(this.$store.state.call.audioOutputDevice)
      }
    }
  },
  beforeDestroy() {
    if(this.timeOut) clearInterval(this.timeOut)
  },
  components: {
    CallSettings
  },
}
</script>

<style scoped>
.call {
  background: black;
  overflow: hidden;
  position: relative;
}
.video {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  max-height: 100%;
}
.noImage {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
.noImage img {
  min-width: 100px;
  min-height: 100px;
  max-width: 200px;
  max-height: 200px;
  width: 30vw;
  height: 30vw;
  border: 5px solid var(--accent-color);
  border-radius: 100%;
  object-fit: cover;
}
.noImage p {
  color: white;
  text-align: center;
  margin-top: 20px;
}
.localVideo {
  position: absolute;
  right: 0;
  top: 0;
  max-width: 25%;
  max-height: 25%;
  border: 5px solid var(--bg-color);
  border-radius: 0 0 0 10px;
  background: black;
  opacity: .4;
  transition: .3s;
}
.localVideo:hover {
  opacity: 1;
}
.controls {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translate(-50%, 0);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-color);
  padding: 10px;
  border-radius: 10px 10px 0 0;
  opacity: .4;
  transition: .3s;
}
.controls:hover {
  opacity: 1;
}
.controls div {
  margin: 0 10px;
}
.controls div:first-child {
  margin: 0 20px 0 10px;
}
.controls i {
  cursor: pointer;
  font-size: 24px;
}
.controls div:first-child i {
  color: red;
}
.controls div:last-child {
  margin: 0 10px 0 20px;
}
.settings-btn {
  position: absolute;
  top: 5px;
  left: 5px;
  font-size: 32px;
  color: var(--accent-color);
  cursor: pointer;
  opacity: .6;
}
.settings-btn:hover {
  opacity: 1;
}
.settings label{
  display: block;
  z-index: 10;
}
</style>
