<template>
  <PopUp
    title="Settings"
    icon="fa-user-cog"
    :buttons="buttons"
    @close="$store.dispatch('popUp/close', 'settings')"
  >
    <div class="avatar">
      <div class="img" @click="$refs.file.click()" :style="{'background-image': `url('${$store.state.backendURL}/static/${$store.state.user.avatar}')`}">
        <div class="border" ref="border"></div>
      </div>
      <label for="file">Click to change avatar (max 20MB)</label>
      <input id="file" type="file" hidden ref="file" @change="changeAvatar()">
    </div>
    <div class="devices">
      <h3>Notification devices:</h3>

      <ul>
        <li
          v-for="device in $store.state.user.devices"
          :key="device._id"
          @click="removeDevice(device)"
        >{{ device.name }}<i class="fas fa-trash"/></li>
      </ul>
      <p v-if="!$store.state.user.devices.length">Add your devices to receive short notifications, when one of your friends wants to speak to you.</p>

      <div v-if="!deviceSubscription" class="device-buttons">
        <button v-if="$store.state.user.devices.length" @click="testDevices()">Test devices</button>
        <button :disabled="adding" @click="startDeviceAdding()">Add device</button>
      </div>
      <div v-else class="device-buttons add-device">
        <input v-model="newDeviceName" @keyup.enter="addDevice()" placeholder="Give a name for this device" autofocus>
        <button @click="addDevice()">Save</button>
      </div>
    </div>
  </PopUp>
</template>

<script>
import PopUp from '~/components/popUp/popUp'

export default {
  data() {
    return {
      buttons: [{
        text: 'Log out',
        action: () => this.$store.dispatch('logout')
      }],
      deviceSubscription: null,
      newDeviceName: '',
      adding: false,
    }
  },
  methods: {
    changeAvatar() {
      if(!this.$refs.file.files[0]) return

      let formData = new FormData()
      formData.append('avatar', this.$refs.file.files[0])

      this.$axios.$post(`/avatar/${this.$store.state.user._id}`, formData, {
        Headers: {'Content-Type': 'multipart/form-data'},
        onUploadProgress: progressEvent => {
          if(!this.$refs.border) return

          let deg = Math.round((progressEvent.loaded * 360) / progressEvent.total)
          this.$refs.border.style.backgroundImage = `conic-gradient(var(--green) ${deg}deg, var(--accent-color) ${deg}deg)`
        }
      })
        .then( avatar => this.$store.dispatch('setUserAvatar', avatar) )
        .catch( err => {
          console.error(err)
          errorBox('Error!', 'Failed to change avatar')
        })
    },
    startDeviceAdding() {
      if(this.adding) return

      if(!("serviceWorker" in navigator))
        return errorBox('Error!', 'This browser does not support this feature')

      this.adding = true

      navigator.serviceWorker.ready
        .then( reg => {
          let config = {
            applicationServerKey: 'BHolPVncmPPJ2ho6n8V8lhLthMLK3s09JRraFamhnl8xji377P0ZaFXuMUZCVLMnlOh9wHoA-F-yZx9rxu4O-Ho',
            userVisibleOnly: true
          }

          return reg.pushManager.subscribe(config)
        })
        .then( sub => this.deviceSubscription = sub )
        .catch( err => {
          console.error(err)
          errorBox('Error!', 'Failed to add device')
        })
        .finally( () => this.adding = false)
    },
    addDevice() {
      if(!this.newDeviceName.trim())
        return errorBox('Error!', 'Please enter a name for the device')

      this.$axios.$post('/addDevice', {
        name: this.newDeviceName.trim(),
        endpoint: this.deviceSubscription.endpoint,
        subscription: this.deviceSubscription.toJSON(),
      })
        .then( device => this.$store.dispatch('addDevice', device) )
        .catch( err => {
          console.error(err)
          errorBox('Error!', 'Failed to add device')
        })
        .finally( () => {
          this.deviceSubscription = null
          this.newDeviceName = ''
        })
    },
    removeDevice(device) {
      if( !confirm(`Do you want to remove this device: ${device.name}?`) ) return
        
      this.$axios.$delete(`/removeDevice/${device._id}`)
        .then( () => this.$store.dispatch('removeDevice', device) )
        .catch( err => {
          console.error(err)
          errorBox('Error!', 'Failed to remove device')
        })
    },
    testDevices() {
      this.$axios.$post('/testDevices')
        .then( devices => {
          if(devices.length != this.$store.state.user.devices.length)
            warningBox('Partial success!', 'Some of your notification devices expired and was removed.')

          this.$store.dispatch('setDevices', devices)
        })
        .catch( err => {
          console.error(err)
          errorBox('Error!', 'Failed to test devices')
        })
    }
  },
  components: {
    PopUp
  }
}
</script>

<style scoped>
.avatar {
  margin: 30px 0;
}
.avatar .img {
  width: 100px;
  height: 100px;
  border-radius: 100%;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  background-color: var(--bg-color);
  margin: 0 auto 10px;
  cursor: pointer;
  position: relative;
}
.avatar .img .border {
  position: absolute;
  top: -5px;
  left: -5px;
  bottom: -5px;
  right: -5px;
  border-radius: 100%;
  z-index: -1;
  background-color: var(--green);
  background-origin: border-box;
  background-clip: content-box, border-box;
}
.avatar label {
  display: block;
  color: var(--accent-color);
  font-size: 16px;
  text-align: center;
  cursor: pointer;
}
.devices {
  margin-bottom: 10px;
  text-align: center;
}
.devices h3 {
  font-size: 18px;
}
.devices ul {
  margin-top: 5px;
  font-size: 18px;
  list-style-type: none;
}
.devices ul li {
  cursor: pointer;
}
.devices ul li i {
  display: none;
  margin-left: 10px;
  font-size: 16px;
}
.devices ul li:hover i {
  display: inline;
}
.devices p {
  font-size: 16px;
}
.devices .device-buttons {
  display: flex;
  justify-content: center;
  align-content: center;
  margin: 5px 0 20px;
}
.devices .device-buttons button {
  padding: 5px 10px;
  border-radius: 5px;
  border: 1px solid black;
  cursor: pointer;
  margin: 0 5px;
  background: var(--accent-color);
}
.devices .add-device {
  margin-top: 10px;
}
.devices .add-device input {
  padding: 3px 5px;
  background: var(--accent-color);
  border: 1px solid black;
  border-radius: 5px;
}
.devices .add-device input::placeholder {
  color: var(--side-color);
}
.logout {
  text-align: center;
  color: var(--accent-color);
  cursor: pointer;
  position: sticky;
  bottom: 0;
}
</style>