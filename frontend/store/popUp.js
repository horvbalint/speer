export const strict = false

export const state = () => ({
  addFriends: false,
  profile: false,
  call: false,
  callSettings: false,
  ping: false,
  file: false,
  notification: false,
  images: [],
  video: false,
  filesToConfirm: false,
  changelog: false,
  feedback: false,
})

export const mutations = {
  reset(state) {
    state.addFriends = false
    state.profile = false
    state.call = false
    state.callSettings = false
    state.ping = false
    state.file = false
    state.notification = false
    state.images = []
    state.video = false
    state.filesToConfirm = false
    state.changelog = false
    state.feedback = false
  },
  open(state, popUp) {
    state[popUp] = true
  },
  close(state, popUp) {
    state[popUp] = false
  },
  set(state, {popUp, value}) {
    state[popUp] = value
  },
}

export const actions = {
  open(ctx, popUp) {
    ctx.commit('open', popUp)
  },
  close(ctx, popUp) {
    ctx.commit('close', popUp)
  },
  set(ctx, config) {
    ctx.commit('set', config)
  },
  reset(ctx) {
    ctx.commit('reset')
  }
}