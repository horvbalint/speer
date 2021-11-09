import Pusher from '../plugins/pusher'
import PeerClient from '../plugins/peerclient'

export default ({$axios, redirect, store}) => {
  return new Promise( (resolve, reject) => {
    let pusher = new Pusher({address: process.env.NODE_ENV == 'development' ? 'ws://localhost:9003' : 'wss://speer.fun:9003'})
    let peerClient = new PeerClient({address: process.env.NODE_ENV == 'development' ? 'ws://localhost:9002' : 'wss://speer.fun:9002'})
    // let pusher = new Pusher({address: 'ws://localhost:9003'})
    // let peerClient = new PeerClient({address: 'ws://localhost:9002'})

    Promise.all([
      $axios.$get('/me'),
      $axios.$get('/friends'),
      // pusher.connect(),
      // peerClient.connect(),
    ])
    .then( ([user, friends, pusher, peerClient]) => {
      store.dispatch('setUser', user)
      store.dispatch('setFriends', friends)
      // store.dispatch('setPusher', pusher)
      // store.dispatch('setPeerClient', peerClient)

      resolve()
    })
    .catch( () => {
      store.dispatch('logout')
      redirect('/login')
    })
  })
}