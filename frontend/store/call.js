export const strict = false

export const state = () => ({
  partner: null,
  fullScreen: false,
})

export const mutations = {
  reset(state) {
    state.partner = null
  },
  setCallPartner(state, partner) {
    state.partner = partner
  },
  setFullScreen(state, value) {
    state.fullScreen = value
  }
}

export const actions = {
  call(ctx, {remoteId = ctx.rootState.partnerId, video = false}) {
    if(ctx.rootState.connecting.call) return

    ctx.commit('setCallPartner', ctx.rootState.friends[remoteId])
    ctx.dispatch('checkCallConnection', remoteId)
    .then( () => navigator.mediaDevices.getUserMedia({audio: ctx.rootGetters.call.constraints.audio, video: false}) )
    .then( stream => {
      ctx.commit('setLocalStream', {remoteId, stream}, {root: true})
      ctx.commit('setInCall', {remoteId, inCall: true}, {root: true})

      ctx.rootState.sounds.callWaiting.currentTime = 0
      ctx.rootState.sounds.callWaiting.play().catch(err => {})
    
      return ctx.rootGetters.call.connection.call(stream, {video})
    })
    .then( () => {
      if(video) ctx.dispatch('enableVideo')
      ctx.dispatch('stopSound', 'callWaiting', {root: true})
    })
    .catch( err => {
      console.error(err)
      ctx.dispatch('resetCall', {remoteId}, {root: true})
      ctx.commit('setCallPartner', null)
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
  checkCallConnection(ctx, partnerId) {
    if(!ctx.rootGetters.call.connection)
      return ctx.dispatch('createCallConnection', partnerId)
    else
      return Promise.resolve()
  },
  setCallConnectionListeners(ctx, {remoteId, connection}) {
    connection.onClose = () => {
      ctx.dispatch('resetCall', {remoteId, full: true}, {root: true})
      ctx.dispatch('reset')
    }
    connection.onRequest = request => {
      request.caller = ctx.rootState.friends[remoteId]
      ctx.commit('popUp/set', {popUp: 'call', value: Object.assign(request, {at: Date.now()})}, {root: true})
    }
    connection.onDecline = () =>  {
      ctx.dispatch('resetCall', {remoteId}, {root: true})
      ctx.dispatch('reset')
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

      if(ctx.rootGetters.call.startTime)
        ctx.commit('addMessage', {
          remoteId: remoteId,
          senderId: remoteId,
          message: `Call ended. Duration: ${formatTime(Date.now()-ctx.rootGetters.call.startTime)}`,
          call: true
        }, {root: true})

      ctx.dispatch('resetCall', {remoteId}, {root: true})
      ctx.dispatch('reset')
    }
  },
  accept(ctx, remoteId) {
    if(ctx.state.partner)
      ctx.dispatch('hangUp')

    navigator.mediaDevices.getUserMedia({video: false, audio: true})
      .then( stream => {
        ctx.commit('setCallPartner', ctx.rootState.popUp.call.caller)
        ctx.commit('setLocalStream', {remoteId, stream}, {root: true})
        ctx.rootState.popUp.call.accept(stream)
        ctx.commit('popUp/set', {popUp: 'call', value: null}, {root: true})
        ctx.commit('setInCall', {remoteId, inCall: true}, {root: true})
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
  hangUp(ctx, remoteId = ctx.state.partner._id) {
    ctx.rootGetters.call.connection.end()

    if(ctx.rootGetters.call.startTime)
      ctx.commit('addMessage', {
        remoteId,
        senderId: ctx.state.partner._id,
        message: `Call ended. Duration: ${formatTime(Date.now()-ctx.rootGetters.call.startTime)}`,
        call: true,
      }, {root: true})
    
    ctx.dispatch('resetCall', {remoteId}, {root: true})
    ctx.dispatch('reset')
  },
  reset(ctx) {
    ctx.commit('reset')
  },
  unmuteAudio(ctx, remoteId = ctx.state.partner._id) {
    if(!ctx.rootGetters.call.stream) return
    ctx.dispatch('muteAudio')

    navigator.mediaDevices.getUserMedia({audio: ctx.rootGetters.call.constraints.audio, video: false})
      .then( stream => {
        let track = stream.getAudioTracks()[0]
        
        ctx.rootGetters.call.connection.peer.addTrack(track, ctx.rootGetters.call.stream)
        ctx.rootGetters.call.stream.addTrack(track)
        
        ctx.commit('setTrack', {remoteId, type: 'audio', device: 'main', track}, {root: true})
      })
      .catch( err => console.error(err) )
  },
  muteAudio(ctx, remoteId = ctx.state.partner._id) {
    if(!ctx.rootGetters.call.stream || !ctx.rootGetters.call.tracks.audio.main) return

    ctx.rootGetters.call.tracks.audio.main.stop()
    try {
      ctx.rootGetters.call.connection.peer.removeTrack(ctx.rootGetters.call.tracks.audio.main, ctx.rootGetters.call.stream)
    } catch(err) {}
    ctx.rootGetters.call.stream.removeTrack(ctx.rootGetters.call.tracks.audio.main)

    ctx.commit('setTrack', {remoteId, type: 'audio', device: 'main', track: null}, {root: true})
  },
  enableVideo(ctx, remoteId = ctx.state.partner._id) {
    if(!ctx.rootGetters.call.stream) return
    ctx.dispatch('stopScreenCapture')
    ctx.dispatch('disableVideo')

    let startingVideoConstraints = {
      height: {ideal: 1080},
      frameRate: {ideal: 60}
    }
    if(ctx.rootGetters.call.constraints.video.deviceId)
      startingVideoConstraints.deviceId = ctx.rootGetters.call.constraints.video.deviceId

    navigator.mediaDevices.getUserMedia({audio: false, video: startingVideoConstraints})
      .then( stream => {
        let track = stream.getVideoTracks()[0]
        track.applyConstraints(ctx.rootGetters.call.constraints.video)

        ctx.rootGetters.call.stream.addTrack(track)
        ctx.rootGetters.call.connection.peer.addTrack(track, ctx.rootGetters.call.stream)

        ctx.commit('setTrack', {remoteId, type: 'video', device: 'main', track}, {root: true})
      })
      .catch( err => console.error(err) )
  },
  disableVideo(ctx, remoteId = ctx.state.partner._id) {
    if(!ctx.rootGetters.call.stream || !ctx.rootGetters.call.tracks.video.main) return

    ctx.rootGetters.call.tracks.video.main.stop()
    try {
      ctx.rootGetters.call.connection.peer.removeTrack(ctx.rootGetters.call.tracks.video.main, ctx.rootGetters.call.stream)
    } catch(err) {}
    ctx.rootGetters.call.stream.removeTrack(ctx.rootGetters.call.tracks.video.main)

    ctx.commit('setTrack', {remoteId, type: 'video', device: 'main', track: null}, {root: true})
  },
  startScreenCapture(ctx, remoteId = ctx.state.partner._id) {
    if(!ctx.rootGetters.call.stream) return
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

        videoTrack.applyConstraints(ctx.rootGetters.call.constraints.video)

        ctx.rootGetters.call.stream.addTrack(videoTrack)
        ctx.rootGetters.call.connection.peer.addTrack(videoTrack, ctx.rootGetters.call.stream)
        ctx.commit('setTrack', {remoteId, type: 'video', device: 'screen', track: videoTrack}, {root: true})

        if(audioTrack) {
          ctx.rootGetters.call.stream.addTrack(audioTrack)
          ctx.rootGetters.call.connection.peer.addTrack(audioTrack, ctx.rootGetters.call.stream)
          ctx.commit('setTrack', {remoteId, type: 'audio', device: 'screen', track: audioTrack}, {root: true})
        }
      })
      .catch( err => console.error(err) )
  },
  stopScreenCapture(ctx, remoteId = ctx.state.partner._id) {
    if(!ctx.rootGetters.call.stream) return

    if(ctx.rootGetters.call.tracks.video.screen) {
      ctx.rootGetters.call.tracks.video.screen.stop()
      try{
        ctx.rootGetters.call.connection.peer.removeTrack(ctx.rootGetters.call.tracks.video.screen, ctx.rootGetters.call.stream)
      } catch(err) {}
      ctx.rootGetters.call.stream.removeTrack(ctx.rootGetters.call.tracks.video.screen)
  
      ctx.commit('setTrack', {remoteId, type: 'video', device: 'screen', track: null}, {root: true})
    }

    if(ctx.rootGetters.call.tracks.audio.screen) {
      ctx.rootGetters.call.tracks.audio.screen.stop()
      try{
        ctx.rootGetters.call.connection.peer.removeTrack(ctx.rootGetters.call.tracks.audio.screen, ctx.rootGetters.call.stream)
      } catch(err) {}
      ctx.rootGetters.call.stream.removeTrack(ctx.rootGetters.call.tracks.audio.screen)
  
      ctx.commit('setTrack', {remoteId, type: 'audio', device: 'screen', track: null}, {root: true})
    }
  },
  setConstraints(ctx, {remoteId = ctx.state.partner._id, constraints}) {
    let selectedNewAudioDevice = constraints.audio.deviceId != ctx.rootGetters.call.constraints.audio.deviceId
    let selectedNewVideoDevice = constraints.video.deviceId != ctx.rootGetters.call.constraints.video.deviceId
    ctx.commit('setConstraints', {remoteId, constraints}, {root: true})

    if(ctx.rootGetters.call.tracks.audio.main) {
      if(selectedNewAudioDevice) {
        ctx.dispatch('muteAudio')
        setTimeout( () => ctx.dispatch('unmuteAudio'), 100)
      }
      else
        ctx.rootGetters.call.tracks.audio.main.applyConstraints(constraints.audio)
    }
  
    if(ctx.rootGetters.call.tracks.video.main) {
      if(selectedNewVideoDevice) {
        ctx.dispatch('disableVideo')
        setTimeout( () => ctx.dispatch('enableVideo'), 100)
      }
      else
        ctx.rootGetters.call.tracks.video.main.applyConstraints(constraints.video)
    }

    if(ctx.rootGetters.call.tracks.video.screen)
      ctx.rootGetters.call.tracks.video.screen.applyConstraints(constraints.video)
  },
  setFullScreen(ctx, value) {
    ctx.commit('setFullScreen', value)
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