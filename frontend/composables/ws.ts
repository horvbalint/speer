import type { Message } from '~/../backend/bindings/Message'

export class WebSocketClient {
  ws: WebSocket
  statePromise: Promise<void>

  constructor() {
    const config = useRuntimeConfig()

    this.ws = new WebSocket(config.public.wsURL)
    this.statePromise = new Promise((resolve, reject) => {
      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data) as Message
        if (message.msgType === 'pusher') // pusher
          this.pusherHandler(message)
        else // signaling
          this.signalHandler(message)
      }

      this.ws.onerror = reject
      this.ws.onopen = () => resolve()
    })
  }

  send(data: any) {
    this.ws.send(JSON.stringify(data))
  }

  pusherHandler(_data: any) {}
  signalHandler(_data: any) {}
}

export const $ws = new WebSocketClient()
