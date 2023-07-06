import type { SignalData } from 'simple-peer'
import type { SignalMessage } from '../../backend/bindings/SignalMessage'

export class Signaler {
  constructor() {
    $ws.signalHandler = this.handleSignal
  }

  signal(userId: string, peerData: SignalData) {
    const message: SignalMessage = {
      type: 'binary',
      remoteId: userId,
      peerData: JSON.stringify(peerData),
      data: null,
    }

    $ws.send(message)
  }

  handleSignal(message: SignalMessage) {
    processSignal(message.remoteId, JSON.parse(message.peerData))
  }
}

export const $signaler = new Signaler()
