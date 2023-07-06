import type { SignalData } from 'simple-peer'
import SimplePeer from 'simple-peer'

export class Connection {
  private peer: SimplePeer.Instance

  constructor(peer: SimplePeer.Instance) {
    this.peer = peer

    this.peer.on('data', data => this.onMessage(data.toString()))
  }

  send(message: string) {
    this.peer.send(message)
  }

  onMessage(_message: string) {}
}

function getPendingPeers() {
  return useState('connections', () => new Map<String, SimplePeer.Instance>())
}

export function useConnectionHandlers() {
  return useState('connectionHandlers', () => ({
    onConnection(_userId: string, _connection: Connection) {},
  }))
}

export function processSignal(userId: string, peerData: SignalData) {
  const pendingPeers = getPendingPeers()

  const pendingPeer = pendingPeers.value.get(userId)
  if (!pendingPeer)
    processInitiatorSignal(userId, peerData)
  else
    pendingPeer?.signal(peerData)
}

function processInitiatorSignal(userId: string, peerData: SignalData) {
  const peer = new SimplePeer({ initiator: false })
  peer.signal(peerData)

  getPendingPeers().value.set(userId, peer)

  peer.on('error', err => console.error(err)) // TODO: better error handling

  peer.on('signal', (peerData) => {
    $signaler.signal(userId, peerData)
  })

  peer.on('connect', () => {
    const connection = new Connection(peer)
    useConnectionHandlers().value.onConnection(userId, connection)
  })
}

export function createConnectionTo(userId: string): Promise<Connection> {
  return new Promise((resolve, reject) => {
    const peer = new SimplePeer({ initiator: true })
    peer.on('error', error => reject(error)) // TODO: better error handling

    peer.on('signal', (peerData) => {
      $signaler.signal(userId, peerData)

      const pendingPeers = getPendingPeers()
      pendingPeers.value.set(userId, peer)
    })

    peer.on('connect', () => {
      const connection = new Connection(peer)
      resolve(connection)
    })
  })
}
