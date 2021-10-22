import NuxtConfig from '~/../nuxt.config'
import axios from 'axios'
import streamSaver from 'streamsaver'
import { WritableStream as ponyFillWritableStream } from "web-streams-polyfill/ponyfill"

if(!window.WritableStream) {
  streamSaver.WritableStream = ponyFillWritableStream
}

export const strict = false

export const state = () => ({
  isConnected: false, // is connected to the signal-server

  user: null, // logged-in user's data
  client: null, // PeerClient instance (plugins/peerclient.js)
  pusher: null, // Pusher instance (plugins/pusher.js)
  partnerId: null, // id of the currently open partner
  partners: {}, // friends who we are/were connected to in the session, holds data neccecary for communication (see the 'checkPartnerState' mutation)
  friends: {}, // user data of our friends
  requests: [], // friend requests

  filesToConfirm: [], // files waiting to be sent after using the Web Share Target API
  
  sideBarDrag: null,  // Drag instance (plugins/drag.js)
  popUpDrag: null, // Drag instance (plugins/drag.js)
  screenWidth: 1000, // width of the screen
  beforeInstallPrompt: null, // deffered PWA install event
  pageVisible: true, // is the page visible
  backendURL: process.env.NODE_ENV == 'development' ? 'http://localhost:9001' : 'https://speer.fun:9001',
  frontendURL: process.env.NODE_ENV == 'development' ? 'http://localhost:9000' : 'https://speer.fun',
  // backendURL: 'http://localhost:9001',
  // frontendURL: 'http://localhost:9000',
  sounds: {
    message: null, // sound to play when a message is received
    call: null, // sound to play when a call is received
    callWaiting: null, // sound to play when a call is waiting
  },
  connecting: {
    text: false,
    file: false,
    call: false,
  }
})

export const getters = {
  // the currently open partner's data from the partners object
  partner: state => {
    if(!state.partnerId) return null

    return state.partners[state.partnerId]
  },
  // the currently open partner's data from the friends object
  partnerFriend: state => {
    if(!state.partnerId) return null

    return state.friends[state.partnerId]
  },
  // the current call partner's data from the partners call object
  call: state => {
    if(!state.call.partner) return {}

    return state.partners[state.call.partner._id].call
  }
}

export const mutations = {
  setUser(state, user) {
    state.user = user
  },
  setClient(state, client) {
    state.client = client
  },
  setPusher(state, pusher) {
    state.pusher = pusher
  },
  checkPartnerState(state, remoteId) {
    if(!state.partners[remoteId]) this._vm.$set(state.partners, remoteId, {
      text: {
        connection: null,
        messages: [],
        unread: false
      },
      file: {
        connection: null,
        buffer: [],
        message: null,
        image: null,
        acceptAllInSession: null,
      },
      call: {
        isInCall: false,
        connection: null,
        stream: null,
        tracks: {
          audio: {
            main: null,
            screen: null,
          },
          video: {
            main: null,
            screen: null,
          },
        },
        remoteStream: null,
        hasRemoteAudio: false,
        hasRemoteVideo: false,
        constraints: {
          video: {
            height: { max: 1080 },
            frameRate: { max: 25 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          }
        },
        startTime: null
      }
    })
  },
  addConnection(state, {remoteId, type, connection}) {   
    state.partners[remoteId][type].connection = connection
  },
  closeConnection(state, {type, remoteId}) {
    if(remoteId == state.partnerId) state.partnerId = null
    if(!state.partners[remoteId][type].connection) return

    state.partners[remoteId][type].connection.close()
    state.partners[remoteId][type].connection = null
  },
  addMessage(state, {remoteId, senderId = remoteId, ...properties}) {
    if(!properties.message || !properties.message.trim()) {
      // There is (hopefully just was) a bug, when a call/file request came through as a message
      console.log("GOTCHA!")
      console.trace()
    }
    
    let message = {
      sender: senderId,
      timeStamp: Date.now(),
      ...properties
    }

    try {
      new URL(message.message)
      message.url = true
    } catch(err) {}

    state.partners[remoteId].text.messages.push(message)

    if(remoteId != state.partnerId) {
      state.partners[remoteId].text.unread = true
      state.sounds.message.currentTime = 0
      state.sounds.message.play().catch(err => {})
    }
    else if(!state.pageVisible || state.call.fullScreen) {
      state.sounds.message.currentTime = 0
      state.sounds.message.play().catch(err => {})
    }
  },
  removeMessage(state, {remoteId, index}) {
    state.partners[remoteId].text.messages.splice(index, 1)
  },
  setPercent(state, {remoteId, index, percent}) {
    state.partners[remoteId].text.messages[index].percent = percent * 100
  },
  setFileBuffer(state, {remoteId, buffer}) {
    state.partners[remoteId].file.buffer = buffer
  },
  reset(state) {
    state.user = null
    state.client = null
    state.pusher = null
    state.partnerId = null
    state.partners = {}
    state.friends = {}
    state.requests = []
    state.sideBarDrag = null
    state.popUpDrag = null
    state.screenWidth = 1000
    state.beforeInstallPrompt = null
    state.pageVisible = true
    state.filesToConfirm = []
    state.backendURL = process.env.NODE_ENV == 'development' ? 'http://localhost:9001' : 'https://speer.fun:9001'
    state.frontendURL = process.env.NODE_ENV == 'development' ? 'http://localhost:9000' : 'https://speer.fun'
    // state.backendURL = 'http://localhost:9001'
    // state.frontendURL = 'http://localhost:9000'
    state.sounds = {
      message: null,
      call: null,
      callWaiting: null,
    }
    state.connecting = {
      text: false,
      file: false,
      call: false,
    }
  },
  setSideBarDrag(state, drag) {
    state.sideBarDrag = drag
  },
  setPopUpDrag(state, drag) {
    state.popUpDrag = drag
  },
  setScreenWidth(state, width) {
    state.screenWidth = width
  },
  setOnlines(state, onlines) {
    for(let id in state.friends) {
      if(onlines.includes(id))
        state.friends[id].online = true
      else
        state.friends[id].online = false
    }
  },
  setOnline(state, {remoteId, online}) {
    state.friends[remoteId].online = online
  },
  setRequests(state, requests) {
    state.requests = requests
  },
  addRequest(state, request) {
    state.requests.push(request)
  },
  removeRequest(state, index = 0) {
    state.requests.splice(index, 1)
  },
  setFriends(state, friends) {
    let friendsObj = {}

    for(let friend of friends)
      friendsObj[friend._id] = {...friend, online: false}

    state.friends = friendsObj
  },
  addFriend(state, friend) {
    this._vm.$set(state.friends, friend._id, {...friend, online: false})
  },
  setPartnerId(state, partnerId) {
    state.partnerId = partnerId

    if(state.partners[partnerId])
      state.partners[partnerId].text.unread = false
  },
  setDevices(state, devices) {
    state.user.devices = devices
  },
  addDevice(state, device) {
    state.user.devices.push(device)
  },
  removeDevice(state, device) {
    state.user.devices = state.user.devices.filter( d => d._id != device._id )
  },
  setUserAvatar(state, avatar) {
    state.user.avatar = avatar
  },
  setSounds(state, {message, call, callWaiting}) {
    state.sounds.message = message
    state.sounds.call = call
    state.sounds.callWaiting = callWaiting
  },
  setSound(state, {name, sound}) {
    state.sounds[name] = sound
  },
  setVisible(state, visible) {
    state.pageVisible = visible
  },
  setAcceptAllInSession(state, {partnerId, value}) {
    state.partners[partnerId].file.acceptAllInSession = value
  },
  setFilesToConfirm(state, files) {
    state.filesToConfirm = files
  },
  setIsConnected(state, value) {
    state.isConnected = value
  },

  // CALL STUFF
  resetCall(state, {remoteId, full = false}) {
    if(!state.partners[remoteId]) return

    state.partners[remoteId].call.isInCall = false
    state.partners[remoteId].call.stream = null
    state.partners[remoteId].call.tracks.audio.main = null
    state.partners[remoteId].call.tracks.audio.screen = null
    state.partners[remoteId].call.tracks.video.main = null
    state.partners[remoteId].call.tracks.video.screen = null
    state.partners[remoteId].call.remoteStream = null
    state.partners[remoteId].call.hasRemoteAudio = false
    state.partners[remoteId].call.hasRemoteVideo = false
    state.partners[remoteId].call.constraints = {
      video: {
        height: { max: 1080 },
        frameRate: { max: 25 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      }
    }
    state.partners[remoteId].call.startTime = null
    
    if(full)
      state.partners[remoteId].call.connection = null
  },
  setInCall(state, {remoteId, inCall}) {
    state.partners[remoteId].call.isInCall = inCall
  },
  setCallConnection(state, {remoteId, connection}) {
    state.partners[remoteId].call.connection = connection
  },
  setLocalStream(state, {remoteId, stream}) {
    state.partners[remoteId].call.stream = stream

    state.partners[remoteId].call.tracks.audio.main = stream.getAudioTracks()[0] || null
    state.partners[remoteId].call.tracks.video.main = stream.getVideoTracks()[0] || null
  },
  setTrack(state, {remoteId, type, device, track}) {
    state.partners[remoteId].call.tracks[type][device] = track
  },
  setRemoteStream(state, {remoteId, stream}) {
    if(!state.partners[remoteId].call.startTime) state.partners[remoteId].call.startTime = Date.now()
    state.partners[remoteId].call.remoteStream = stream

    state.partners[remoteId].call.remoteStream.addEventListener('removetrack', () => {
      state.partners[remoteId].call.hasRemoteAudio = !!stream.getAudioTracks().length
      state.partners[remoteId].call.hasRemoteVideo = !!stream.getVideoTracks().length
    })

    state.partners[remoteId].call.hasRemoteAudio = !!stream.getAudioTracks().length
    state.partners[remoteId].call.hasRemoteVideo = !!stream.getVideoTracks().length
  },
  setConstraints(state, {remoteId, constraints}) {
    state.partners[remoteId].call.constraints = constraints
  },
  setConnecting(state, {type, value}) {
    state.connecting[type] = value
  },
  setBeforeInstallPrompt(state, event) {
    state.beforeInstallPrompt = event
  }
}

export const actions = {
  setUser(ctx, user) {
    ctx.commit('setUser', user)
  },
  setPeerClient(ctx, peerClient) {
    ctx.commit('setClient', peerClient)
    ctx.commit('setIsConnected', true)

    peerClient._onClose = () => {
      ctx.commit('setIsConnected', false)
      errorBox('Connection lost with the server!', 'You can still use your established connections, but can not create new ones untill reconnected.', {
        text: 'Reload',
        action: () => location.reload(),
      })
    }

    peerClient.onConnection = ({remoteId, connection}) => {
      setTextConnectionListeners(ctx, remoteId, connection)
      
      ctx.commit('checkPartnerState', remoteId)
      ctx.commit('addConnection', {remoteId, type: 'text', connection})
    }

    peerClient.onFileConnection = ({remoteId, connection}) => {
      setFileConnectionListeners(ctx, remoteId, connection)
      
      ctx.commit('checkPartnerState', remoteId)
      ctx.commit('addConnection', {remoteId, type: 'file', connection})
    }

    peerClient.onCallConnection = ({remoteId, connection}) => {
      ctx.commit('checkPartnerState', remoteId)
      ctx.commit('setCallConnection', {remoteId, connection})
      ctx.dispatch('call/setCallConnectionListeners', {remoteId, connection})
    }
  },
  setPusher(ctx, pusher) {
    ctx.commit('setPusher', pusher)
    
    pusher.subscribe( 'request', request => ctx.commit('addRequest', request) )
    pusher.subscribe( 'login', remoteId => ctx.commit('setOnline', {remoteId, online: true}) )
    pusher.subscribe( 'logout', remoteId => {
      if(ctx.state.partners[remoteId])
        ctx.dispatch('resetPartner', remoteId)

      if(ctx.state.popUp.call && ctx.state.popUp.call.caller._id == remoteId)
        ctx.dispatch('popUp/set', {popUp: 'call', value: null})
        
      ctx.commit('setOnline', {remoteId, online: false})
    })
    pusher.subscribe( 'friend', async friend => {
      ctx.commit('addFriend', friend)
  
      axios.get(`${NuxtConfig.axios.baseURL}/online/${friend._id}`, {withCredentials: true})
        .then( ({data: online}) => ctx.commit('setOnline', {remoteId: friend._id, online}) )
        .catch( err => console.error(err) )
    })
  
    axios.get(`${NuxtConfig.axios.baseURL}/onlines`, {withCredentials: true})
      .then( ({data: onlines}) => ctx.commit('setOnlines', onlines) )
      .catch( err => console.error(err) )

    axios.get(`${NuxtConfig.axios.baseURL}/request`, {withCredentials: true})
      .then( ({data: requests}) => ctx.commit('setRequests', requests) )
      .catch( err => console.error(err) )
  },
  createTextConnection(ctx, remoteId) {
    return new Promise( (resolve, reject) => {
      ctx.commit('setConnecting', {type: 'text', value: remoteId})
      ctx.state.client.createConnection(remoteId)
        .then( connection => {
          setTextConnectionListeners(ctx, remoteId, connection)
          ctx.commit('addConnection', {remoteId, type: 'text', connection})
          resolve()
        })
        .catch( err => {
          if(err == 'Not friend')
            errorBox('Error!', 'This user is not your friend')
          else
            errorBox('Error!', `Could not connect to ${ctx.state.friends[remoteId].username}`)

          reject(err)
        })
        .finally( () => ctx.commit('setConnecting', {type: 'text', value: false}) )
    })
  },
  checkTextConnection(ctx, partnerId) {
    if(!ctx.state.partners[partnerId].text.connection)
      return ctx.dispatch('createTextConnection', partnerId)
    else
      return Promise.resolve()
  },
  createFileConnection(ctx, remoteId) {
    return new Promise( (resolve, reject) => {
      if(!ctx.state.isConnected) {
        warningBox('You are not connected to the server!', 'Try to reload the page and check your network connection', {
          text: 'Reload',
          action: () => location.reload()
        })
        
        return reject()
      }

      ctx.commit('setConnecting', {type: 'file', value: remoteId})
      ctx.state.client.createFileConnection(remoteId)
        .then( connection => {
          setFileConnectionListeners(ctx, remoteId, connection)
          ctx.commit('addConnection', {remoteId, type: 'file', connection})
          resolve()
        })
        .catch( err => {
          console.error(err)
          errorBox('Error!', `Could not connect to ${ctx.state.friends[remoteId].username}`)
          reject()
        })
        .finally( () => ctx.commit('setConnecting', {type: 'file', value: false}) )
    })
  },
  checkFileConnection(ctx, partnerId) {
    if(!ctx.state.partners[partnerId].file.connection)
      return ctx.dispatch('createFileConnection', partnerId)
    else
      return Promise.resolve()
  },
  reset(ctx) {
    if(ctx.state.call.partner)
      ctx.dispatch('call/hangUp')

    for(let remoteId in ctx.state.partners) {
      ctx.commit('closeConnection', {remoteId, type: 'text'})
      ctx.commit('closeConnection', {remoteId, type: 'file'})
      ctx.dispatch('resetCall', {remoteId, full: true})
    }

    ctx.commit('reset')
  },
  resetPartner(ctx, remoteId) {
    if(ctx.state.call.partner && ctx.state.call.partner._id === remoteId)
      ctx.dispatch('call/hangUp')

    ctx.commit('closeConnection', {remoteId, type: 'text'})
    ctx.commit('closeConnection', {remoteId, type: 'file'})
    ctx.dispatch('resetCall', {remoteId, full: true})
  },
  resetCall(ctx, {remoteId, full = false}) {
    ctx.dispatch('call/disableVideo', remoteId)
    ctx.dispatch('call/stopScreenCapture', remoteId)
    ctx.dispatch('call/muteAudio', remoteId)

    ctx.commit('resetCall', {remoteId, full})

    ctx.dispatch('stopSound', 'callWaiting')
  },
  sendMessage(ctx, {remoteId = ctx.state.partnerId, message}) {
    ctx.commit('addMessage', {remoteId, senderId: ctx.state.user._id, message})
    ctx.state.partners[remoteId].text.connection.send({
      timeStamp: Date.now(),
      message
    })
  },
  sendFiles(ctx, {remoteId = ctx.state.partnerId, files}) {
    return new Promise( (resolve, reject) => {
      ctx.dispatch('checkFileConnection', remoteId)
      .then( async () => {
        for(let file of files) {
          let messageIndex = ctx.state.partners[remoteId].text.messages.length
          let percentCallback = percent => ctx.commit('setPercent', {remoteId, percent, index: messageIndex})
          
          ctx.commit('addMessage', {
            remoteId,
            senderId: ctx.state.user._id,
            message: file.name,
            file: true,
            percent: 0,
          })
    
          await ctx.state.partners[remoteId].file.connection.send(file, percentCallback)
            .catch( err => {
              console.error(err)
              ctx.commit('removeMessage', {remoteId, index: messageIndex})
            })
        }

        resolve()
      })
      .catch( err => {
        console.error(err)
        reject(err)
      })
    })
  },
  setOnlines(ctx, onlines) {
    ctx.commit('setOnlines', onlines)
  },
  setFriends(ctx, friends) {
    ctx.commit('setFriends', friends)
  },
  openPartner(ctx, partnerId) {
    return new Promise( (resolve, reject) => {
      ctx.commit('checkPartnerState', partnerId)
      ctx.dispatch('checkTextConnection', partnerId)
        .then( () => {
          ctx.commit('setPartnerId', partnerId)
          resolve()
        })
        .catch( err => reject(err) )
    })
  },
  closeParnter(ctx) {
    ctx.commit('setPartnerId', null)
  },
  acceptRequest(ctx) {
    let request = ctx.state.requests[0]

    axios.post(`${NuxtConfig.axios.baseURL}/accept/${request._id}`, null, {withCredentials: true})
      .then( () => {
        ctx.commit('addFriend', request)
        ctx.commit('removeRequest')
        return axios.get(`${NuxtConfig.axios.baseURL}/online/${request._id}`, {withCredentials: true})
      })
      .then( ({data: online}) => ctx.commit('setOnline', {remoteId: request._id, online}) )
      .catch( err => {
        console.error(err)
        errorBox('Error!', 'Accepting request failed')
      })
  },
  declineRequest(ctx) {
    axios.post(`${NuxtConfig.axios.baseURL}/decline/${ctx.state.requests[0]._id}`, {}, {withCredentials: true})
    .then( () => ctx.commit('removeRequest') )
    .catch( err => {
      console.error(err)
      errorBox('Error!', 'Declining request failed')
    })
  },
  addDevice(ctx, device) {
    ctx.commit('addDevice', device)
  },
  removeDevice(ctx, device) {
    ctx.commit('removeDevice', device)
  },
  setSideBarDrag(ctx, drag) {
    ctx.commit('setSideBarDrag', drag)
  },
  setPopUpDrag(ctx, drag) {
    ctx.commit('setPopUpDrag', drag)
  },
  setScreenWidth(ctx, width) {
    ctx.commit('setScreenWidth', width)
  },
  setUserAvatar(ctx, avatar) {
    ctx.commit('setUserAvatar', avatar)
  },
  setDevices(ctx, devices) {
    ctx.commit('setDevices', devices)
  },
  acceptFile(ctx, preview = false) {
    let remoteId = ctx.state.popUp.file.sender._id

    let messageIndex = ctx.state.partners[remoteId].text.messages.length
    ctx.commit('addMessage', {
      remoteId,
      senderId: remoteId,
      message: ctx.state.popUp.file.file.name,
      file: true,
      percent: 0,
    })

    if(!preview) {
      let buffer = streamSaver.createWriteStream(ctx.state.popUp.file.file.name, {size: ctx.state.popUp.file.file.size}).getWriter()
      ctx.commit('setFileBuffer', {remoteId, buffer})

      ctx.state.partners[remoteId].file.connection.recvProperties.mode = 'emit'
      ctx.state.partners[remoteId].file.connection.onReceive = chunk => {
        if(chunk.byteLength) ctx.state.partners[remoteId].file.buffer.write(chunk)
        else ctx.state.partners[remoteId].file.buffer.close()
      }
    }
    else {
      ctx.state.partners[remoteId].file.connection.recvProperties.mode = 'accumulate'
      if(ctx.state.popUp.file.file.type.startsWith('video')) {
        ctx.state.partners[remoteId].file.connection.onReceive = file => {
          ctx.commit('popUp/set', {popUp: 'video', value: file})
        }
      }
      else if(ctx.state.popUp.file.file.type.startsWith('image')) {
        ctx.state.partners[remoteId].file.connection.onReceive = file => {
          ctx.commit('popUp/set', {popUp: 'images', value: [...ctx.state.popUp.images, file]})
        }
      }
    }

    ctx.state.popUp.file.accept( percent => ctx.commit('setPercent', {remoteId, percent, index: messageIndex}) )
    ctx.dispatch('popUp/close', 'file')
  },
  declineFile(ctx) {
    ctx.state.popUp.file.decline()
    ctx.dispatch('popUp/close', 'file')
  },
  loadSounds(ctx) {
    let message = new Audio(`${ctx.state.frontendURL}/message.mp3`)
    let call = new Audio(`${ctx.state.frontendURL}/call.mp3`)
    let callWaiting = new Audio(`${ctx.state.frontendURL}/callWaiting.mp3`)

    call.loop = true
    callWaiting.loop = true

    ctx.commit('setSounds', {message, call, callWaiting})
  },
  setVisible(ctx, visible) {
    ctx.commit('setVisible', visible)
  },
  setAcceptAllInSession(ctx, value) {
    ctx.commit('setAcceptAllInSession', value)
  },
  setFilesToConfirm(ctx, files) {
    ctx.commit('setFilesToConfirm', files)
  },
  setIsConnected(ctx, value) {
    ctx.commit('setIsConnected', value)
  },
  stopSound(ctx, name) {
    ctx.state.sounds[name].pause()
    let sound = new Audio(`${ctx.state.frontendURL}/${name}.mp3`)

    if(name.startsWith('call'))
      sound.loop = true

    ctx.commit('setSound', {name, sound})
  },
  logout(ctx) {
    if(ctx.state.client)
      ctx.state.client.destroy()

    if(ctx.state.pusher) {
      ctx.state.pusher.unsubscribe('login')
      ctx.state.pusher.unsubscribe('friend')
      ctx.state.pusher.unsubscribe('logout')
      ctx.state.pusher.unsubscribe('request')

      ctx.state.pusher.destroy()
    }

    ctx.dispatch('reset')
    ctx.commit('call/reset')
    ctx.commit('popUp/reset')

    axios.post(`${NuxtConfig.axios.baseURL}/logout`, null, {withCredentials: true})
    this.$router.push('/login')
  },
  setBeforeInstallPrompt(ctx, event) {
    ctx.commit('setBeforeInstallPrompt', event)
  }
}

function setTextConnectionListeners(ctx, remoteId, connection) {
  connection.onClose = () => ctx.commit('closeConnection', {remoteId, type: 'text'})
  connection.onData = message => ctx.commit('addMessage', {remoteId, message: message.message})
}

function setFileConnectionListeners(ctx, remoteId, connection) {
  connection.onClose = () => ctx.commit('closeConnection', {remoteId, type: 'file'})
  connection.onDecline = () => alertBox('Declined file!', `${ctx.state.friends[remoteId].username} declined your file`)
  connection.onRequest = request => {
    request.sender = ctx.state.friends[remoteId]
    ctx.dispatch('popUp/set', {popUp: 'file', value: request})

    if(ctx.state.partners[remoteId].file.acceptAllInSession) {
      let isImage = request.file.type.startsWith('image')
      let shouldPreview = ctx.state.partners[remoteId].file.acceptAllInSession.preview

      ctx.dispatch('acceptFile', isImage && shouldPreview)
    }
    else {
      ctx.state.sounds.message.currentTime = 0
      ctx.state.sounds.message.play().catch(err => {})
    }
  }
}