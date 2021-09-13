export const strict = false

export const state = () => ({
  addFriends: false,
  settings: false,
  call: false,
  callSettings: false,
  ping: false,
  file: false,
  notification: false,
  image: false,
  filesToConfirm: false,
  changelog: false,
  feedback: false,
})

export const mutations = {
  reset(state) {
    state.addFriends = false
    state.settings = false
    state.call = false
    state.callSettings = false
    state.ping = false
    state.file = false
    state.notification = false
    state.image = false
    state.filesToConfirm = false
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