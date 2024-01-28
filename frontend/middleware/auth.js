import Pusher from '../plugins/pusher'
import PeerClient from '../plugins/peerclient'

export default ({$axios, redirect, store, $config}) => {
  return new Promise( (resolve, reject) => {
    const wsAddress = new URL($config.backendUrl)
    wsAddress.protocol = wsAddress.protocol.endsWith('s:') ? 'wss:' : 'ws:'
    wsAddress.pathname += 'ws/'

    let socket = new WebSocket(wsAddress.href)
    let pusher = new Pusher()
    let peerClient = new PeerClient()

    Promise.all([
      $axios.$get('/me'),
      $axios.$get('/friends'),
      initSocket(socket, pusher, peerClient),
    ])
    .then( ([user, friends]) => {
      store.dispatch('setUser', user)
      store.dispatch('setFriends', friends)
      store.dispatch('setPusher', pusher)
      store.dispatch('setPeerClient', peerClient)

      resolve()
    })
    .catch( () => {
      store.dispatch('logout')
      redirect('/login')
    })
  })
}

function initSocket(socket, pusher, peerClient) {
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => {
      pusher.init(socket)
      peerClient.init(socket)

      resolve()
    })

    socket.addEventListener('error', error => {
      console.error(error)
      reject()
    })

    socket.addEventListener('close', error => {
      console.error(error)
      reject()
    })
  })
}
