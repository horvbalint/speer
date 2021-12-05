export const strict = false

export const state = () => ({
  partners: [],
  isFullScreen: false,
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
})

export const getters = {
  isInCall(state) {
    return !!state.partners.length
  }
}

export const mutations = {
  setStream(state, stream) {
    state.stream = stream

    state.tracks.audio.main = stream.getAudioTracks()[0] || null
    state.tracks.video.main = stream.getVideoTracks()[0] || null
  },
  setTrack(state, {type, device, track}) {
    state.tracks[type][device] = track
  },
  setConstraints(state, constraints) {
    state.constraints = constraints
  },
  reset(state) {
    state.partners = []
    state.stream = null
    state.tracks.audio.main = null
    state.tracks.audio.screen = null
    state.tracks.video.main = null
    state.tracks.video.screen = null
    state.constraints = {
      video: {
        height: { max: 1080 },
        frameRate: { max: 25 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      }
    }
  },
  removePartner(state, remoteId) {
    state.partners = state.partners.filter( p => p._id !== remoteId )
  },
  addPartner(state, partner) {
    state.partners.push(partner)
  },
  setIsFullScreen(state, value) {
    state.isFullScreen = value
  }
}

export const actions = {
  call(ctx, {remoteId = ctx.rootState.partnerId, video = false}) {
    if(ctx.rootState.connecting.call) return

    ctx.commit('addPartner', ctx.rootState.friends[remoteId])
    ctx.dispatch('checkCallConnection', remoteId)
    .then( () => navigator.mediaDevices.getUserMedia({audio: ctx.state.constraints.audio, video: false}) )
    .then( stream => {
      ctx.commit('setStream', stream)

      ctx.rootState.sounds.callWaiting.currentTime = 0
      ctx.rootState.sounds.callWaiting.play().catch(err => {})
    
      return ctx.rootState.partners[remoteId].call.connection.call(stream, {video})
    })
    .then( () => {
      if(video) ctx.dispatch('enableVideo')
      ctx.dispatch('stopSound', 'callWaiting', {root: true})
    })
    .catch( err => {
      console.error(err)
      ctx.dispatch('resetCall', remoteId)
    })
  },
  createCallConnection(ctx, remoteId) {
    return new Promise( (resolve, reject) => {
      if(!ctx.rootState.isConnected) {
        warningBox('You are not connected to the server!', 'Try to reload the page and check your network connection', {
          text: 'Reload',
          action: () => location.reload()
        })
        
        return reject()
      }

      ctx.commit('setConnecting', {type: 'call', value: remoteId}, {root: true})
      ctx.rootState.client.createCallConnection(remoteId)
      .then( connection => {
        ctx.dispatch('setCallConnectionListeners', {remoteId, connection})
        ctx.commit('setCallConnection', {remoteId, connection}, {root: true})
        
        resolve()
      })
      .catch( err => reject(err) )
      .finally( () => ctx.commit('setConnecting', {type: 'call', value: false}, {root: true}) )
    })
  },
  checkCallConnection(ctx, remoteId) {
    if(!ctx.rootState.partners[remoteId].call.connection)
      return ctx.dispatch('createCallConnection', remoteId)
    else
      return Promise.resolve()
  },
  setCallConnectionListeners(ctx, {remoteId, connection}) {
    connection.onClose = () => {
      ctx.dispatch('resetCall', remoteId)
      ctx.commit('closeConnection', remoteId, {root: true})
    }
    connection.onRequest = request => {
      request.caller = ctx.rootState.friends[remoteId]
      ctx.commit('popUp/set', {popUp: 'call', value: Object.assign(request, {at: Date.now()})}, {root: true})
    }
    connection.onDecline = () =>  {
      ctx.dispatch('resetCall', remoteId)

      alertBox('Declined call!', `${ctx.rootState.friends[remoteId].username} declined your call!`)
    }
    connection.onTrack = (track, stream) => ctx.commit('setRemoteStream', {remoteId, stream}, {root: true})
    connection.onEnd = () => {
      if(ctx.rootState.popUp.call) {
        ctx.commit('addMessage', {
          remoteId: remoteId,
          senderId: remoteId,
          message: `Missed call. Rang for: ${formatTime(Date.now()-ctx.rootState.popUp.call.at)}`,
          call: true,
          missed: true
        }, {root: true})
        
        ctx.commit('popUp/set', {popUp: 'call', value: null}, {root: true})
      }

      if(ctx.rootState.partners[remoteId].call.startTime)
        ctx.commit('addMessage', {
          remoteId: remoteId,
          senderId: remoteId,
          message: `Call ended. Duration: ${formatTime(Date.now()-ctx.rootState.partners[remoteId].call.startTime)}`,
          call: true
        }, {root: true})

      ctx.dispatch('resetCall', remoteId)
    }
  },
  accept(ctx) {
    if(ctx.state.partners.length)
      ctx.dispatch('hangUp')

    navigator.mediaDevices.getUserMedia({video: false, audio: true})
      .then( stream => {
        ctx.commit('addPartner', ctx.rootState.popUp.call.caller)
        ctx.commit('setStream', stream)
        ctx.rootState.popUp.call.accept(stream)
        ctx.commit('popUp/set', {popUp: 'call', value: null}, {root: true})
      })
      .catch( err => {
        console.error(err)
        ctx.dispatch('decline')
      })
  },
  decline(ctx) {
    ctx.rootState.popUp.call.decline()
    ctx.commit('popUp/set', {popUp: 'call', value: null}, {root: true})
  },
  hangUp(ctx, partners = ctx.state.partners) {
    for(let partner of partners) {
      let call = ctx.rootState.partners[partner._id].call

      call.connection.end()

      if(call.startTime)
        ctx.commit('addMessage', {
          remoteId: partner._id,
          senderId: partner._id,
          message: `Call ended. Duration: ${formatTime(Date.now()-call.startTime)}`,
          call: true,
        }, {root: true})
      
      ctx.dispatch('resetCall', partner._id)
    }
  },
  resetCall(ctx, remoteId) {
    if(ctx.state.partners.length == 1) {
      ctx.dispatch('disableVideo')
      ctx.dispatch('stopScreenCapture')
      ctx.dispatch('muteAudio')

      ctx.commit('reset')
    }
    
    ctx.commit('removePartner', remoteId)
    ctx.commit('resetCall', remoteId, {root: true})
    ctx.dispatch('stopSound', 'callWaiting', {root: true})
  },
  unmuteAudio(ctx, partners = ctx.state.partners) {
    ctx.dispatch('muteAudio')

    navigator.mediaDevices.getUserMedia({audio: ctx.state.constraints.audio, video: false})
    .then( stream => {
      let track = stream.getAudioTracks()[0]
      
      for(let partner of partners) {
        let call = ctx.rootState.partners[partner._id].call
        
        call.connection.peer.addTrack(track, ctx.state.stream)
        ctx.state.stream.addTrack(track)
        ctx.commit('setTrack', {type: 'audio', device: 'main', track})
      }
    })
    .catch( err => console.error(err) )
  },
  muteAudio(ctx, partners = ctx.state.partners) {
    for(let partner of partners) {
      let call = ctx.rootState.partners[partner._id].call
      
      if(!ctx.state.stream || !ctx.state.tracks.audio.main) continue
  
      ctx.state.tracks.audio.main.stop()

      try {
        call.connection.peer.removeTrack(ctx.state.tracks.audio.main, ctx.state.stream)
      } catch(err) {}
      
      ctx.state.stream.removeTrack(ctx.state.tracks.audio.main)
      ctx.commit('setTrack', {type: 'audio', device: 'main', track: null})
    }
  },
  enableVideo(ctx, partners = ctx.state.partners) {   
    ctx.dispatch('stopScreenCapture')
    ctx.dispatch('disableVideo')

    let startingVideoConstraints = {
      height: {ideal: 1080},
      frameRate: {ideal: 60}
    }
    if(ctx.state.constraints.video.deviceId)
      startingVideoConstraints.deviceId = ctx.state.constraints.video.deviceId

    navigator.mediaDevices.getUserMedia({audio: false, video: startingVideoConstraints})
      .then( stream => {
        let track = stream.getVideoTracks()[0]
        track.applyConstraints(ctx.state.constraints.video)

        for(let partner of partners) {
          let call = ctx.rootState.partners[partner._id].call
          
          ctx.state.stream.addTrack(track)
          call.connection.peer.addTrack(track, ctx.state.stream)
  
          ctx.commit('setTrack', {type: 'video', device: 'main', track})
        }
      })
      .catch( err => console.error(err) )
  },
  disableVideo(ctx, partners = ctx.state.partners) {
    if(!ctx.state.stream || !ctx.state.tracks.video.main) return

    ctx.state.tracks.video.main.stop()
    
    for(let partner of partners) {
      let call = ctx.rootState.partners[partner._id].call
      
      try {
        call.connection.peer.removeTrack(ctx.state.tracks.video.main, ctx.state.stream)
      } catch(err) {}
    }
    
    ctx.state.stream.removeTrack(ctx.state.tracks.video.main)
    ctx.commit('setTrack', {type: 'video', device: 'main', track: null})
  },
  startScreenCapture(ctx, partners = ctx.state.partners) {
    if(!ctx.state.stream) return
    ctx.dispatch('disableVideo')
    ctx.dispatch('stopScreenCapture')

    let startingVideoConstraints = {
      height: {ideal: 1080},
      frameRate: {ideal: 60}
    }
    
    if(!navigator.mediaDevices.getDisplayMedia) return
    navigator.mediaDevices.getDisplayMedia({audio: true, video: startingVideoConstraints})
      .then( stream => {
        let videoTrack = stream.getVideoTracks()[0]
        let audioTrack = stream.getAudioTracks()[0]

        videoTrack.applyConstraints(ctx.state.constraints.video)
        ctx.state.stream.addTrack(videoTrack)

        if(audioTrack)
          ctx.state.stream.addTrack(audioTrack)

        for(let partner of partners) {
          let call = ctx.rootState.partners[partner._id].call
          
          call.connection.peer.addTrack(videoTrack, ctx.state.stream)
          ctx.commit('setTrack', {type: 'video', device: 'screen', track: videoTrack})
        
          if(audioTrack) {
            call.connection.peer.addTrack(audioTrack, ctx.state.stream)
            ctx.commit('setTrack', {type: 'audio', device: 'screen', track: audioTrack})
          }
        }
      })
      .catch( err => console.error(err) )
  },
  stopScreenCapture(ctx, partners = ctx.state.partners) {
     if(!ctx.state.stream) return

    if(ctx.state.tracks.video.screen) {
      ctx.state.tracks.video.screen.stop()

      for(let partner of partners) {
        let call = ctx.rootState.partners[partner._id].call
        
        try{
          call.connection.peer.removeTrack(ctx.state.tracks.video.screen, ctx.state.stream)
        } catch(err) {}
      }
      
      ctx.state.stream.removeTrack(ctx.state.tracks.video.screen)
      ctx.commit('setTrack', {type: 'video', device: 'screen', track: null})
    }

    if(ctx.state.tracks.audio.screen) {
      ctx.state.tracks.audio.screen.stop()
      ctx.state.stream.removeTrack(ctx.state.tracks.audio.screen)
      ctx.commit('setTrack', {type: 'audio', device: 'screen', track: null})

      for(let partner of partners) {
        let call = ctx.rootState.partners[partner._id].call
        
        try{
          call.connection.peer.removeTrack(ctx.state.tracks.audio.screen, ctx.state.stream)
        } catch(err) {}
      }
    }
  },
  setConstraints(ctx, constraints) {
    let selectedNewAudioDevice = constraints.audio.deviceId != ctx.state.constraints.audio.deviceId
    let selectedNewVideoDevice = constraints.video.deviceId != ctx.state.constraints.video.deviceId
    ctx.commit('setConstraints', constraints)

    if(ctx.state.tracks.audio.main) {
      if(selectedNewAudioDevice) {
        ctx.dispatch('muteAudio')
        setTimeout( () => ctx.dispatch('unmuteAudio'), 100)
      }
      else
        ctx.state.tracks.audio.main.applyConstraints(constraints.audio)
    }
  
    if(ctx.state.tracks.video.main) {
      if(selectedNewVideoDevice) {
        ctx.dispatch('disableVideo')
        setTimeout( () => ctx.dispatch('enableVideo'), 100)
      }
      else
        ctx.state.tracks.video.main.applyConstraints(constraints.video)
    }

    if(ctx.state.tracks.video.screen)
      ctx.state.tracks.video.screen.applyConstraints(constraints.video)
  },
  setIsFullScreen(ctx, value) {
    ctx.commit('setIsFullScreen', value)
  },
  addPartner(ctx, partner) {
    let partners = ctx.state.partners.map(p => p._id)
    ctx.rootState.client.createGroupConnection(partner._id, partners)
      .then( connection => {
        ctx.commit('checkPartnerState', partner._id)
        ctx.commit('addConnection', {remoteId: partner._id, type: 'call', connection})

        ctx.commit('addPartner', partner)
      })
      .catch( err => {
        console.error(err)
        errorBox(`Failed to add '${partner.username}' to the call!`)
      })
  }
}

function formatTime(time) {
  let timeInSeconds = Math.round(time/1000)

  let hours = Math.floor(timeInSeconds / 3600)
  let minutes = Math.floor((timeInSeconds - (hours*3600)) / 60)
  let secs = timeInSeconds - (hours*3600) - (minutes*60)

  let str = ''
  if(hours) str += `${String(hours).padStart(2, '0')}:`
  str += `${String(minutes).padStart(2, '0')}:`
  str += `${String(secs).padStart(2, '0')}`
  
  return str
}