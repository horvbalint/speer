<template>
  <div class="call" ref="call">
    <div v-if="!choosenPartnerCall.hasRemoteVideo" class="noImage">
      <img :src="`${$store.state.backendURL}/static/${choosenPartner.avatar}`">

      <p v-if="!choosenPartnerCall.remoteStream">Waiting for {{choosenPartner.username}} to response...</p>
      <p v-else>{{ currentDuration }}</p>
    </div>
    <video v-else :srcObject.prop="choosenPartnerCall.remoteStream" class="video" autoplay/>

    <div class="videoThumbnails">
      <!-- <div v-for="partner in this.$store.state.call.partners" :key="partner._id" class="thumbnail" :class="{choosen: choosenPartnerCall == $store.state.partners[partner._id].call}">
        <img v-if="!$store.state.partners[partner._id].call.hasRemoteVideo" :src="`${$store.state.backendURL}/static/${partner.avatar}`">
        <video v-else :srcObject.prop="$store.state.partners[partner._id].call.remoteStream" autoplay muted/>

        <p>{{partner.username}}</p>
      </div> -->

      <div class="thumbnail choosen">
        <video :srcObject.prop="choosenPartnerCall.remoteStream" autoplay muted/>
        <p>Egyik partner</p>
      </div>

      <div class="thumbnail">
        <img :src="`${$store.state.backendURL}/static/${choosenPartner.avatar}`">
        <p>Masik nagyon hosszu nevu partner</p>
      </div>

      <i class="fas fa-user-plus" @click="$store.dispatch('popUp/open', 'addCallPartner')"/>

      <template v-if="hasLocalVideo">
        <hr>
  
        <div v-if="hasLocalVideo" class="thumbnail own" ref="localVideo">
          <video :srcObject.prop="$store.state.call.stream" autoplay muted/>
          <p>Your video stream</p>
        </div>
      </template>
    </div>

    <audio ref="secondAudio" hidden autoplay/>

    <i class="fas fa-cog settings-btn" @click="$store.dispatch('popUp/open', 'callSettings')"/>

    <div class="controls">
      <div>
        <i class="fas fa-phone-slash" @click="$store.dispatch('call/hangUp')"></i>
      </div>

      <div>
        <i v-if="$store.state.call.tracks.audio.main" class="fas fa-microphone" @click="$store.dispatch('call/muteAudio')"></i>
        <i v-else class="fas fa-microphone-slash" @click="$store.dispatch('call/unmuteAudio')"></i>
      </div>

      <div>
        <i v-if="$store.state.call.tracks.video.main" class="fas fa-video" @click="$store.dispatch('call/disableVideo')"></i>
        <i v-else class="fas fa-video-slash" @click="$store.dispatch('call/enableVideo')"></i>
      </div>

      <div v-if="canScreenShare">
        <i v-if="$store.state.call.tracks.video.screen" class="fas fa-times" @click="$store.dispatch('call/stopScreenCapture')"></i>
        <i v-else class="fas fa-desktop" @click="$store.dispatch('call/startScreenCapture')"></i>
      </div>

      <div>
        <i v-if="!$store.state.call.isFullScreen" class="fas fa-expand" @click="requestFullScreen()"></i>
        <i v-else class="fas fa-compress" @click="leaveFullScreen()"></i>
      </div>
    </div>

    <transition name="pop">
      <CallSettings v-if="$store.state.popUp.callSettings" :sources="sources"/>
    </transition>
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
      choosenPartner: null,
      sources: {
        audio: [],
        video: [],
      },
    }
  },
  computed: {
    choosenPartnerCall() {
      if(!this.choosenPartner) return null

      return this.$store.state.partners[this.choosenPartner._id].call
    },
    hasLocalVideo() {
      return !!this.$store.state.call.tracks.video.main || !!this.$store.state.call.tracks.video.screen
    }
  },
  created() {
    this.choosenPartner = this.$store.state.call.partners[0]

    if(navigator.mediaDevices.getDisplayMedia)
      this.canScreenShare = true

    navigator.mediaDevices.enumerateDevices()
    .then( devices => {
      for(let device of devices) {
        switch(device.kind) {
          case 'audioinput':  this.sources.audio.push(device); break;
          case 'videoinput':  this.sources.video.push(device); break;
        }
      }
    })
  },
  methods: {
    requestFullScreen() {
      let promise = this.$refs.call.requestFullscreen ?  this.$refs.call.requestFullscreen() : this.$refs.call.webkitRequestFullscreen()

      promise.then( () => {
        this.$store.dispatch('call/setIsFullScreen', true)

        document.addEventListener('fullscreenchange', () => {
          if(!document.fullscreenElement)
            this.$store.dispatch('call/setIsFullScreen', false)
        })
      })
    },
    leaveFullScreen() {
      if (document.exitFullscreen) document.exitFullscreen()
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen()

      this.$store.dispatch('call/setIsFullScreen', false)
    },
    calculateCallDuration() {
      let duration = Math.floor((Date.now()-this.choosenPartnerCall.startTime)/1000)

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
    'choosenPartnerCall.remoteStream': function() {
      if(!this.choosenPartnerCall.remoteStream) return

      if(!this.timeOut)
        this.timeOut = setInterval(this.calculateCallDuration, 1000)

      this.choosenPartnerCall.remoteStream.addEventListener('addtrack', ({track}) => {
        if(this.choosenPartnerCall.remoteStream.getAudioTracks().length < 2) return

        this.$refs.secondAudio.srcObject = new MediaStream([track])
      })

      this.choosenPartnerCall.remoteStream.addEventListener('removetrack', () => {
        if(!this.$refs.secondAudio) return

        this.$refs.secondAudio.srcObject = null
      })
    },
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
.videoThumbnails {
  position: absolute;
  right: 0;
  top: 0;
  height: 15%;
  max-height: 100px;
  border-radius: 0 0 0 10px;
  background: var(--bg-color);
  padding: 5px;
  display: flex;
  align-items: center;
}
.videoThumbnails .thumbnail {
  position: relative;
  aspect-ratio: 4/3;
  height: 100%;
  margin-right: 10px;
  cursor: pointer;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--side-color);
}
.videoThumbnails .thumbnail:last-child {
  margin-right: 0;
}
.videoThumbnails .choosen {
  border: 3px solid var(--green);
}
.videoThumbnails .own {
  border: 3px solid var(--yellow);
  aspect-ratio: auto;
}
.videoThumbnails .thumbnail video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.videoThumbnails .thumbnail img {
  aspect-ratio: 1/1;
  height: 80%;
  border-radius: 100%;
}
.videoThumbnails .thumbnail p {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 5px;
  color: var(--accent-color);
  background: rgba(0, 0, 0, 0.8);
  word-break: break-word;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  opacity: 0;
  transition: opacity var(--speed-fast);
}
.videoThumbnails .thumbnail p:hover {
  opacity: 1;
}
.videoThumbnails i {
  font-size: 25px;
  color: var(--accent-color);
  margin: 5px;
}
.videoThumbnails hr {
  border: 1px solid var(--accent-color);
  border-radius: 5px;
  margin-right: 10px;
  height: 70%;
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