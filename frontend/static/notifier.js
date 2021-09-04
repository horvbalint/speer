self.addEventListener('push', event => {
  let data = JSON.parse(event.data.text())

  event.waitUntil(
    self.registration.showNotification(data.title , {
      icon: '/icon.png',
      vibrate: [200, 100, 200],
      body: data.body,
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  const urlToOpen = new URL('https://speer.fun').href
  
  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  })
    .then( windowClients => {
      let matchingClient = windowClients.find( client => client.url == urlToOpen )

      if(matchingClient) return matchingClient.focus()
      else return clients.openWindow(urlToOpen)
    })

  event.waitUntil(promiseChain)
})

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    fetch('https://speer.fun:9001/pushsubscriptionchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        oldEndpoint: event.oldSubscription ? event.oldSubscription.endpoint : null,
        newEndpoint: event.newSubscription ? event.newSubscription.endpoint : null,
        subscription: event.newSubscription ? event.newSubscription.toJSON() : null,
      })
    })
  )
})