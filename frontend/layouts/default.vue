<template>
  <div class="container">
    <div class="page" :class="{inCall: $store.getters.call.isInCall}">
      <transition name="scale" mode="out-in">
        <Call class="call-section" v-if="$store.getters.call.isInCall"/>
      </transition>
      <Nuxt class="nuxt"/>
    </div>

    <SideBar class="sidebar" ref="sideBar" @close="closeSideBar()"/>

    <transition name="notifade">
      <div class="version-noti" v-if="showVersionNotification" @click="refreshToUpdate()">
        <p>There is a new version available, click here to update!</p>
        <i class="fas fa-chevron-circle-up"/>
      </div>
    </transition>

    <transition name="pop">
      <CallPopUp v-if="$store.state.popUp.call"></CallPopUp>
      <FilePopUp v-else-if="$store.state.popUp.file"></FilePopUp>
      <PingPopUp v-else-if="$store.state.popUp.ping"></PingPopUp>
      <RequestPopUp v-else-if="$store.state.requests.length"/>
      <ProfilePopUp v-else-if="$store.state.popUp.profile"/>
      <AddFriendsPopUp v-else-if="$store.state.popUp.addFriends"/>
      <NotificationPopUp v-else-if="$store.state.popUp.notification"/>
      <FilesToConfirmPopUp v-else-if="$store.state.popUp.filesToConfirm"/>
      <ChangelogPopUp v-else-if="$store.state.popUp.changelog"/>
      <FeedbackPopUp v-else-if="$store.state.popUp.feedback"/>
      <BreakingChangePopUp v-else-if="showBreakingPopUp"/>
      <ImageViewer v-else-if="$store.state.popUp.image"/>
    </transition>

    <Alert/>
  </div>
</template>

<script>
import SideBar from '~/components/sideBar'
import Alert from '~/components/popUp/alert'
import AddFriendsPopUp from '~/components/popUp/addFriends'
import ProfilePopUp from '~/components/popUp/profile'
import RequestPopUp from '~/components/popUp/requests'
import PingPopUp from '~/components/popUp/ping'
import CallPopUp from '~/components/popUp/call'
import FilePopUp from '~/components/popUp/file'
import NotificationPopUp from '~/components/popUp/notification'
import ImageViewer from '~/components/popUp/imageViewer'
import FilesToConfirmPopUp from '~/components/popUp/filesToConfirm'
import ChangelogPopUp from '~/components/popUp/changelog'
import FeedbackPopUp from '~/components/popUp/feedback'
import BreakingChangePopUp from '~/components/popUp/breakingChange'
import PackageJSON from '~/../package.json'

export default {
  middleware: ['auth'],
  data() {
    return {
      showVersionNotification: false,
      showBreakingPopUp: false,
      swRegistration: null,
      version: PackageJSON.version
    }
  },
  async created() {
    const workbox = await window.$workbox
    if(!workbox) return

    workbox.addEventListener('installed', event => {
      if(this.showBreakingPopUp || !event.isUpdate) return

      this.showVersionNotification = true
    })

  },
  mounted() {
    this.$store.dispatch('setScreenWidth', window.innerWidth)
    window.addEventListener('beforeinstallprompt', this.saveBeforeInstallPrompt)
    window.addEventListener('resize', this.handleResize)

    let boundary = -85
    this.$store.dispatch('setSideBarDrag', new Drag({
      range: {from: -100, to: 0},
      multiplier: 1/(this.$store.state.screenWidth/100),
      startOnCreated: this.$store.state.screenWidth <= 800,
      onStart: state => {
        this.$refs.sideBar.$el.style.willChange = 'transform'

        if(state == 0)
          this.$refs.sideBar.$el.classList.remove('open')
        else
          this.$refs.sideBar.$el.classList.remove('closed')
      },
      setter: percent => this.$refs.sideBar.$el.style.transform = `translateX(${percent}%)`,
      onEnd: percent => {
        if(percent < boundary) {
          boundary = -85
          return -100
        }
        else {
          boundary = -15
          return 0
        }
      },
      onDone: state => {
        this.$refs.sideBar.$el.style.willChange = 'auto'

        if(state == 0)
          this.$refs.sideBar.$el.classList.add('open')
        else
          this.$refs.sideBar.$el.classList.add('closed')
      },
    }))

    navigator.serviceWorker.addEventListener('message', this.handleSWMessage)
    navigator.serviceWorker.getRegistration()
      .then( registration => {
        if(registration && registration.active) {
          this.swRegistration = registration
          this.swRegistration.active.postMessage({action: 'ready-to-receive'})

          window.addEventListener('beforeunload', this.disconnectFromSw)
        }
      })
      .catch(err => console.error('COULD NOT GET REGISTRATION', err) )

    this.$axios.$get(`/breaking/${this.version}`)
      .then( wasBreaking => {
        if(wasBreaking) this.showBreakingPopUp = true
      })
      .catch( err => console.error(err) )

    window.onbeforeunload = () => {
      if(this.$store.getters.call.isInCall)
        return 'You are still in a call! Do you really want to close Speer?'

      for(let partner in this.$store.state.partners) {
        if(!this.$store.state.partners[partner].file || !this.$store.state.partners[partner].file.connection)
          continue
        
        if(this.$store.state.partners[partner].file.connection.isSending)
          return 'You are sending a filel! Do you really want to close Speer?'

        if(this.$store.state.partners[partner].file.connection.isReceiving)
          return 'You are receiving a filel! Do you really want to close Speer?'
      }
    }
  },
  methods: {
    refreshToUpdate() {
      this.showVersionNotification = false
      localStorage['showChangelog'] = this.version
      location.reload()
    },
    handleResize() {
      if(this.$store.state.screenWidth <= 800) {
        if(window.innerWidth > 800) {
          this.$store.state.sideBarDrag.stop()
          this.$refs.sideBar.$el.style.transform = 'translateX(0)'
        }
      }
      else {
        if(window.innerWidth <= 800) {
          this.$refs.sideBar.$el.style.transform = `translateX(${this.$store.state.sideBarDrag.state}%)`
          this.$store.state.sideBarDrag.start()
        }
      }

      this.$store.dispatch('setScreenWidth', window.innerWidth)
    },
    closeSideBar() {
      if(this.$store.state.screenWidth > 800) return

      this.$refs.sideBar.$el.style.willChange = 'transform'
      this.$refs.sideBar.$el.style.transition = 'transform .2s ease-out'

      this.$store.state.sideBarDrag.state = -100
      this.$refs.sideBar.$el.style.transform = `translateX(${this.$store.state.sideBarDrag.state}%)`

      this.$refs.sideBar.$el.addEventListener('transitionend', this.handleTransitionEnd, false)
    },
    handleTransitionEnd() {
      this.$refs.sideBar.$el.removeEventListener('transitionend', this.handleTransitionEnd, false)

      this.$refs.sideBar.$el.classList.remove('open')
      this.$refs.sideBar.$el.classList.add('closed')
      this.$refs.sideBar.$el.style.willChange = 'auto'
      this.$refs.sideBar.$el.style.transition = 'none'
    },
    handleSWMessage(event) {
      if(event.data.action !== 'send-files') return

      this.$store.dispatch('setFilesToConfirm', event.data.files)

      if(this.$store.getters.partner)
        this.$store.dispatch('popUp/open', 'filesToConfirm')
    },
    disconnectFromSw() {
      if(!this.swRegistration) return

      this.swRegistration.active.postMessage({action: 'disconnect'})
    },
    saveBeforeInstallPrompt(event) {
      this.$store.dispatch('setBeforeInstallPrompt', event)
    }
  },
  beforeDestroy() {
    this.disconnectFromSw()
    window.removeEventListener('beforeunload', this.disconnectFromSw)
    window.removeEventListener('beforeinstallprompt', this.saveBeforeInstallPrompt)
    window.removeEventListener('resize', this.handleResize)
    navigator.serviceWorker.removeEventListener('message', this.handleSWMessage)

    if(this.$store.state.sideBarDrag)
      this.$store.state.sideBarDrag.stop()

    this.$store.dispatch('reset')
  },
  components: {
    SideBar,
    Alert,
    AddFriendsPopUp,
    ProfilePopUp,
    RequestPopUp,
    PingPopUp,
    CallPopUp,
    FilePopUp,
    ImageViewer,
    NotificationPopUp,
    FilesToConfirmPopUp,
    ChangelogPopUp,
    FeedbackPopUp,
    BreakingChangePopUp,
  }
}
</script>

<style scoped>
.container {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;

  display: grid;
  grid-template-columns: 300px auto;
  grid-template-rows: auto;
  grid-template-areas:
    "sidebar main"
}

.scale-enter-active, .scale-leave-active {
  transition: all .5s  ease-out;
}
.scale-enter, .scale-leave-to {
  opacity: 0;
  height: 0 !important;
}
.call {
  height: 65%;
}
.nuxt {
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: height .5s ease-out;
}
.inCall .nuxt {
  height: 35%;
}

.sidebar {
  grid-area: sidebar;
  transform: translateX(0);
}
.page {
  grid-area: main;
  position: relative;
}

.pop-enter-active, .pop-leave-active {
  transition: var(--speed-normal);
}

.version-noti {
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translate(-50%, 0);
  border-radius: 10px;
  background: var(--accent-color);
  padding: 10px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 0 15px var(--shadow-color);
  max-width: 95%;
  cursor: pointer;
}
.version-noti p {
  font-size: 20px;
  white-space: nowrap;
}
.version-noti i {
  font-size: 20px;
  margin-left: 10px;
}
.refresh-btn {
  padding: 0 !important;
  margin-left: 10px;
}

.notifade-enter-active,
.notifade-leave-active {
  transition: transform var(--speed-normal), opacity var(--speed-normal);
  transform: translate(-50%, 0);
}
.notifade-enter,
.notifade-leave-to {
  opacity: 0;
  transform: translate(-50%, 15px);
}

@media screen and (max-width: 800px) {
  .container {
    display: block;
  }
  .sidebar {
    width: 300px;
    max-width: 60%;

    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;

    transform: translateX(-100%);
  }
  .page {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
  }
}

@media screen and (max-width: 600px) {
  .version-noti {
    padding: 10px;
  }
  .version-noti p {
    font-size: 12px;
    white-space: nowrap;
  }
  .version-noti i {
    display: none;
  }
  .sidebar {
    width: 100%;
    max-width: none;
  }
}
</style>
