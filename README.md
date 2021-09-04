# Speer

  Speer is a fast, privacy focused and open source communication app for various use cases. It is built with peer-to-peer web technologies, which allows it to perform better in many aspects then other similar softwares. Speer can help you to make audio and video calls, to send as big files as you want or just to chat with someone.

  Try and use it at <a href="https://speer.fun">https://speer.fun</a>.


## Why to use Speer?

  - Speer was built with **privacy** in mind. All of the data sent is encrypted and none of it will go trough or be saved on third-party servers. The data you send is only your and your partners buisness. 
  - Speer is **lightweight**, your device is less likely to slow down during calls than while using other screen-sharing solutions. And if it does, you can **customize** Speer to suit your needs even better.
  - Speer is **cross platform**. It can be used on any OS which supports modern browsers. Yes it even works on mobile! You can install Speer from the browser with a single click to unlock even more features.
  - Speer is **free and open source** (FOSS). How would you trust a software that it doesn't spy on your data, when no one can see its internal workings? You shouldn't and luckily you don't have to. Speer's code is visible for everyone and you can use it for free!


## Features

### Sound and video calls

  Have you ever wanted to watch a movie with someone who is phisicly at an other place? Well, with Speer you can. Here is why:

  - In Speer you can share your screen in Full HD and later maybe in even higher resolutions. 
  - You can share your system audio as well.
    - On Windows and Chrome OS you can share every sound on the system.
    - If you are using Linux or Mac OS you can only share the sound of a Chrome tab, but you can open your movies with the browser.
  - While watching the video you can still talk in the same app.
  
  Using the in-call settings you can change the resolution and the frame rate of the stream you send to your partner just like the microphone or video input device. This makes it possible to adjust your stream to the current network conditions. 

### Text messages

  The messages sent or received dissappear after logging out as they are not stored on a server. This functionality is not meant to be an everyday chat (at least for now), but a way to communicate during a call or to chat in a very private way.

### File sending

  Sending files in Speer is as easy as in other apps, but you have no size limitation. The data is not collected in your RAM memory but written directly to your hard drive. File sending speeds are good, but it is something I want to work on even more, so contributions in this regard are espacially welcomed!

  On Android if Speer is installed as a PWA you can share files trough Speer directly from your phones share dialog.
  
  Speer sends the bytes of a file in order, making it possible to watch a video/movie wich you are receiving already while it is being downloaded, if your OS supports this (only tested on Linux).

  Please don't forget that just like messages, files can not be redownloaded from the app. They dissappear right after being downloaded the first time.

### Push notifications

  As mentioned before, Speer connects you to your partner directly leaving out servers from the data-flow. But this also means that you can't talk with someone who is not online. To overcome this problem, one can register its devices to receive push notifications. If you want to talk to someone who has notification devices configured but is not online, you can "ping" (send a short message to) them to let them know that you want to talk to them.


## Donation

  If Speer makes your everydays easier and/or you like the project, please consider buying me a tea at [buymeacoffee.com](https://buymeacoffee.com/speer) (caffeine makes me sick :/).


## Browser support

  The basic functionlities are supported in all major browsers, but some others are not. To get every feature and the fastest speeds use Chrome for now. Here are some of the known issues:
  - Push notifications are not supported in Safari
  - System audio sharing is only supported in Chrome
  - File sending in Firefox and Safari is only possible with a PonyFill which affects the performance a bit


## Disclaimer

  This project is still in development and although it is fairly stable you might encounter problems. I take no responsibility for any damage caused by Speer.


## Development

  **First of all: many thanks if you are planning to invest your time into making Speer better!** Every contribution is welcomed. If you don't know what these instructions below mean, just open an issue with your idea.

  Speer on the frontend is using Nuxt.js (a Vue.js framework) and on the backend Express.js and MongoDB. A Node.js version of 14 or higher is needed to work properly. Both the front and backend is handled in this single repository to make things easier.

### Prerequisites

  npm will install every library needed, but you have to create a configuration file to start the server. This contains every sensitive information (tokens, passwords) of the server. This should be located in the '/backend' folder and be named as 'config.json'. The file's structure is the following:

  ```json
  {
    "mailjet": {
      "public": "",
      "private": ""
    },
    "vapid": {
      "mailto": "",
      "public": "",
      "private": ""
    },
    "ssl": {
      "key": "",
      "cert": ""
    },
    "cookie": {
      "secret": ""
    },
    "confirm": {
      "secret": ""
    }
  }
  ```

  Not every field is required for development mode. You have to provide a random string for the 'confirm' and 'cookie' keys. Generating a public-private key pair for the 'vapid' key can be done using the [web-push](https://www.npmjs.com/package/web-push) library. The 'ssl' and 'mailjet' keys are only needed for production mode.

### Build Setup

  ```bash
  # install dependencies
  $ npm install

  # -- FRONTEND
  # serve in development mode at localhost:9000
  $ npm run dev

  # build for production
  $ npm run generate

  # -- BACKEND
  # start in development mode
  $ npm run server

  # start in production mode
  # this will also staticly host the generated frontend from the 'dist' folder
  $ npm run prod-server

  ```

## Special thanks

  Without the following libraries this project would not exist:

  - [Vue.js](https://vuejs.org/) - for the superb frontend framework
  - [Nuxt.js](https://nuxtjs.org/) - for making Vue.js even better
  - [simple-peer](https://www.npmjs.com/package/simple-peer) - for providing a solid base for the p2p communications
  - [streamsaver](https://www.npmjs.com/package/streamsaver) - for making it possible to save huge files while browsers implement the The File System Access API

## LICENSE
  Speer - A free and open source communication app

  Copyright (C) 2021  Horváth Bálint

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.