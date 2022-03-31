<template>
  <div class="blank-index"  v-if="!$store.getters.partner">
    <div
      v-if="$store.state.beforeInstallPrompt"
      class="install-btn"
      @click="install()"
    >
      <i class="far fa-window-restore"/> Install
    </div>

    <div
    v-if="$store.state.user"
    class="profile"
    @click="$store.dispatch('popUp/open', 'profile')"
    >
      <span>{{$store.state.user.username}}</span>
      <div class="avatar" :style="{'background-image': `url('${$store.state.backendURL}/static/${$store.state.user.avatar}')`}"/>
    </div>

    <div class="content">
      <img src="/svg/chat.svg" alt="">
      
      <template v-if="!$route.query['share-target']">
        <p class="desktop">Choose someone from the sidebar to start chatting</p>
        <p class="mobile">Swipe from the left to see your friends</p>
      </template>
      <p v-else class="file-from-share">Choose a friend who you want to share the files with</p>
    </div>

    <p class="bottom-line">
      <span class="version" @click="showChangeLog()">v{{version}}</span>
      -
      <span class="feedback" @click="$store.dispatch('popUp/open', 'feedback')">give feedback</span>
    </p>
  </div>
  
  <div v-else class="index">
    <div class="header">
      <i class="fas fa-arrow-left" @click="$store.dispatch('closePartner')"/>
      <h2>{{ $store.getters.partnerFriend.username }}</h2>
      <div
        v-if="!$store.getters['call/isInCall']"
        :class="{connecting: $store.state.connecting.call == $store.getters.partnerFriend._id}"
      >
        <i
          class="fas fa-phone"
          :class="{unavailable: !isCallAvailable}"
          @click="$store.dispatch('call/call', {})"
        ></i>
        <i
          class="fas fa-video"
          :class="{unavailable: !isCallAvailable}"
          @click="$store.dispatch('call/call', {video: true})"
        ></i>
      </div>
    </div>

    <div class="messages" ref="messages" @dragover="handleDragOver($event)" @drop="hanldeDrop($event)" @dragleave="handleDragLeave($event)">
      <div v-if="fileDragOver" class="drag-topper">
        <p>Drop files here to send them!</p>
      </div>

      <div
        v-for="(message, index) in $store.getters.partner.text.messages"
        :key="`m-${index}`"
        class="message"
        :class="{
          'own': message.sender == $store.state.user._id,
          'file': message.file,
          'missed': message.missed,
          'url': message.url,
        }"
        :style="{'background-image': `linear-gradient(to right, var(--green) ${message.percent}%, var(--accent-color) ${message.percent}%)`}"
        :title="formatTimeStamp(message.timeStamp)"
        @click="handleMessageClick(message)"
      >
        <p>{{message.message}}
          <i v-if="message.call" class="fas fa-phone"/>
          <i v-else-if="message.file" class="fas fa-file"/>
        </p>
      </div>
    </div>

    <div class="bottom">
      <textarea v-model="message" @keydown.enter.exact.prevent="send()" placeholder="Type here..." autocomplete="off"/>
      <input type="file" multiple hidden ref="file" @change="sendFiles()">
      
      <div class="icons">
        <i
          class="fas fa-file-medical"
          :class="{
            unavailable: !isFileAvailable,
            connecting: $store.state.connecting.file == $store.getters.partnerFriend._id,
          }"
          @click="openFilePicker()"
        ></i>
        <i class="fas fa-paper-plane" @click="send()"></i>
      </div>
    </div>
  </div>
</template>

<script>
import PackageJSON from '~/../package.json'

export default {
  data() {
    return {
      message: '',
      fileDragOver: false,
      notificationSound: null,
      version: PackageJSON.version,
    }
  },
  computed: {
    isCallAvailable() {
      return this.$store.state.isConnected || (this.$store.getters.partner && this.$store.getters.partner.call.connection)
    },
    isFileAvailable() {
      return this.$store.state.isConnected || (this.$store.getters.partner && this.$store.getters.partner.file.connection)
    }
  },
  created() {
    this.$store.dispatch('loadSounds')
  },
  mounted() {
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible')
        this.$store.dispatch('setVisible', true)
      else if(document.visibilityState === 'hidden')
        this.$store.dispatch('setVisible', false)
    })

    if(Notification && Notification.permission == 'default')
      this.$store.dispatch('popUp/open', 'notification')

    if(localStorage['showChangelog']) {
      this.$axios.$get(`/changelog/${localStorage['showChangelog']}`)
        .then( changelog => {
          if(Object.keys(changelog).length)
            this.$store.dispatch('popUp/set', {popUp: 'changelog', value: {title: 'Recent changes', log: changelog}})
        })
        .catch( err => {
          console.error(err)
          alertBox('Updated successfully!', 'Could not load changelog')
        })
        .finally( () => delete localStorage['showChangelog'] )
    }
  },
  methods: {
    send() {
      this.message = this.message.trim()

      if(this.message)
        this.$store.dispatch('sendMessage', {message: this.message})

      this.message = ''
    },
    openFilePicker() {
      this.$refs.file.click()
    },
    sendFiles(files = this.$refs.file.files) {
      if(!files.length || this.$store.state.connecting.file) return

      this.$store.dispatch('sendFiles', {files})
        .then( () => this.$refs.file.value = '' )
    },
    hanldeDrop(event) {
      event.preventDefault()

      let files = 
        event.dataTransfer.items
          ? 
        [...event.dataTransfer.items].filter(i => i.kind == 'file').map(i => i.getAsFile())
          :
        event.dataTransfer.files

      this.sendFiles(files)
      this.fileDragOver = false
    },
    handleDragOver(event) {
      event.preventDefault()
      this.fileDragOver = true
    },
    handleDragLeave(event) {
      event.preventDefault()
      this.fileDragOver = false
    },
    formatTimeStamp(timeStamp) {
      let date = new Date(timeStamp)
      let hours = date.getHours().toString().padStart(2, '0')
      let minutes = date.getMinutes().toString().padStart(2, '0')

      return `${hours}:${minutes}`
    },
    showChangeLog() {
      this.$axios.$get('/changelog')
        .then( changelog => this.$store.dispatch('popUp/set', {popUp: 'changelog', value: {title: 'Changelog', log: changelog}}) )
        .catch( err => {
          console.error(err)
          errorBox('Error!', 'Could not load changelog')
        })
    },
    async install() {
      this.$store.state.beforeInstallPrompt.prompt()

      this.$store.state.beforeInstallPrompt.userChoice
        .then( ({outcome}) => {
          if(outcome == 'accepted')
            this.$store.dispatch('setBeforeInstallPrompt', null)
        })
        .catch( err => {
          errorBox('Error!', 'Something went wrong, try installing Speer later')
          console.error(err)
        })
    },
    handlePasteEvent(event) {
      let files = []
      for(let item of event.clipboardData.items) {
        let file = item.getAsFile()
        if(file) files.push(file)
      }

      if(files.length) {
        event.preventDefault()
        this.$store.dispatch('setFilesToConfirm', files)
        this.$store.dispatch('popUp/open', 'filesToConfirm')
      }
    },
    handleMessageClick(message) {
      if(!message.url) return

      window.open(message.message, '_blank').focus()
    }
  },
  watch: {
    '$store.getters.partner': function() {
      document.removeEventListener('paste', this.handlePasteEvent)
      if(!this.$store.getters.partner) return

      if(this.$store.state.filesToConfirm.length)
        this.$store.dispatch('popUp/open', 'filesToConfirm')

      document.addEventListener('paste', this.handlePasteEvent)
    },
    '$store.getters.partner.text.messages': function(newVal) {
      this.$nextTick( () => {
        if(this.$refs.messages) {
          this.$refs.messages.scrollTop = this.$refs.messages.scrollHeight
        }
      })
    }
  },
}
</script>

<style scoped>
.blank-index {
  font-size: 20px;
  position: absolute;
  left: 0;
  bottom: 0;
  right: 0;
}
.blank-index .install-btn {
  position: absolute;
  top: 5px;
  left: 5px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 10px;
  border-radius: 10px;
  cursor: pointer;
  height: 60px;
  color: var(--accent-color);
  font-size: 20px;
  transition: color background-color var(--speed-normal);
}
.blank-index .install-btn:hover {
  background-color: var(--accent-color);
  color: var(--bg-color);
}
.blank-index i {
  font-size: 25px;
  margin-right: 10px;
}
.blank-index .profile {
  position: absolute;
  top: 5px;
  right: 5px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color var(--speed-normal);
}
.blank-index .profile:hover {
  background-color: var(--accent-color);
}
.blank-index .profile span {
  color: var(--accent-color);
  transition: color var(--speed-normal);
}
.blank-index .profile:hover span {
  color: var(--bg-color);
}
.blank-index .avatar {
  width: 50px;
  height: 50px;
  border-radius: 100%;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  background-color: var(--bg-color);
  border: 4px solid var(--green);
  margin-left: 10px;
}
.blank-index .content {
  position: absolute;
  top: 55%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  max-width: 70%;
  max-height: 70%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.blank-index .content img {
  width: 500px;
  max-width: 100%;
  max-height: 100%;
  pointer-events: none;
}
.inCall .blank-index .content img {
  display: none;
}
.blank-index .content p {
  color: var(--accent-color);
  margin-top: 60px;
  font-size: 24px;
  text-align: center;
}
.blank-index .content .mobile {
  display: none;
}
.blank-index .bottom-line {
  position: absolute;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 14px;
  color: var(--accent-color);
  cursor: pointer;
}
.blank-index .bottom-line span {
  text-decoration: underline;
}
.index {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.header {
  display: flex;
  padding: 10px 20px;
  justify-content: space-between;
  align-items: center;
}
.header i {
  cursor: pointer;
  font-size: 24px;
  transition: var(--speed-fast)
}
.header i:hover {
  color: var(--accent-color);
}
.header .fa-phone {
  margin-right: 10px
}
.unavailable {
  color: var(--grey) !important;
  cursor: default !important;
}
.unavailable:hover {
  color: var(--grey) !important;
}
.messages {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1;
  overflow: auto;
}
.messages > :first-child {
  margin-top: auto
}
.drag-topper {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;

  background: var(--topper-bg);
  backdrop-filter: blur(3px);
  pointer-events: none;
}
.drag-topper p {
  font-size: 24px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  white-space: nowrap;
}
.message {
  max-width: 70%;
  border-radius: 0 15px 15px 0;
  margin: 1px 0;
}
.message:not(.file) {
  background: var(--accent-color);
}
.message i {
  display: inline-block;
  margin-left: 10px;
}
.message p {
  white-space: pre-line;
  padding: 5px 15px 5px 20px;
  font-size: var(--p-size);
  user-select: text;
  word-break: break-word;
}
.percent {
  height: 5px;
  background: purple;
}
.own {
  align-self: flex-end;
  border-radius: 15px 0 0 15px;
}
.own p {
  padding: 5px 20px 5px 15px;
}
.missed {
  background: var(--red) !important;
}
.url {
  text-decoration: underline;
  cursor: pointer;
}
.bottom {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  background: var(--side-color);
  border-radius: 50px;
  padding-right: 10px;
  margin: 10px 20px 5px;
  overflow: hidden;
}
.bottom textarea {
  width: 100%;
  height: 45px;
  padding: 12px 0 12px 20px;
  border: none;
  font-size: 16px;
  resize: none;
}
.icons {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 5px;
}
.icons i {
  font-size: 26px;
  margin: 0 10px;
  cursor: pointer;
  transition: var(--speed-fast)
}
.icons i:hover {
  color: var(--accent-color);
}
.blank-index .content .file-from-share {
  white-space: normal;
  text-align: center;
}
.connecting {
  position: relative;
}
.connecting::after {
  content: '';
  display: block;
  position: absolute;
  bottom: -5px;
  height: 3px;
  border-radius: 3px;
  background: var(--green);
  transform: translateX(-50%);
  animation: connecting 1s ease-in-out infinite alternate;
}

@keyframes connecting {
  0% {
    left: -4%;
    width: 3px;
  }
  5% {
    left: -4%;
    width: 3px;
  }
  50% {
    left: 51%;
    width: 50%;
  }
  95% {
    left: calc(106%);
    width: 3px;
  }
  100% {
    left: calc(106%);
    width: 3px;
  }
}

@media screen and (max-width: 800px) {
  .blank-index {
    position: absolute;
  }
  .blank-index .content .desktop {
    display: none;
  }
  .blank-index .content .mobile {
    display: block;
  }
  .bottom {
    margin: 10px 10px 5px;
  }
}

@media screen and (max-width: 600px) {
  .blank-index .content p {
    font-size: 20px;
    white-space: nowrap;
  }
}
</style>
