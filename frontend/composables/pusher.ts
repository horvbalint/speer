import type { PusherMessage } from '~/../backend/bindings/PusherMessage'

class Pusher {
  private subscriptions: Map<String, Function>

  constructor() {
    this.subscriptions = new Map()
    $ws.pusherHandler = this.eventHandler
  }

  subscribe(event: string, callback: Function) {
    const message: PusherMessage = {
      action: 'subscribe',
      event,
    }

    $ws.send(JSON.stringify(message))
    this.subscriptions.set(event, callback)
  }

  unsubscribe(event: string) {
    const message: PusherMessage = {
      action: 'unsubscribe',
      event,
    }

    $ws.send(JSON.stringify(message))
    this.subscriptions.delete(event)
  }

  eventHandler(event: any) {
    const callback = this.subscriptions.get(event.event)
    if (!callback)
      return

    callback(event.data)
  }
}

export const $pusher = new Pusher()
