let filesToSend = []
let readyToReceive = false

self.addEventListener('fetch', event => {
  if(event.request.url.endsWith('/share-target/') && event.request.method === 'POST') {
    event.respondWith(Response.redirect('/?share-target=true'))

    event.waitUntil(
      (async function () {
        const client = await self.clients.get(event.resultingClientId)
        const data = await event.request.formData()

        let files = []
        for(let [name, file] of data.entries()) {
          if(name !== 'files') continue

          files.push(file)
        }

        if(readyToReceive) {
          client.postMessage({files, action: 'send-files'})
          readyToReceive = false
        }
        else
          filesToSend.push({files, client})
      })(),
    )
  }
})

self.addEventListener('message', event => {
  switch(event.data.action) {
    case 'ready-to-receive': handleReadyToReceive(); break;
    case 'disconnect': handleDisconnect(); break;
  }
})

function handleReadyToReceive() {
  readyToReceive = true

  if(filesToSend.length) {
    let {files, client} = filesToSend.shift()

    client.postMessage({files, action: 'send-files'})
    readyToReceive = false
  }
}

function handleDisconnect() {
  readyToReceive = false
}