const backendUrl = process.env.SPEER_BACKEND_URL || 'http://localhost:9001'

export default {
  /*
  ** Nuxt rendering mode
  ** See https://nuxtjs.org/api/configuration-mode
  */
  ssr: false,
  /*
  ** Nuxt target
  ** See https://nuxtjs.org/api/configuration-target
  */
  target: 'static',
  /*
  ** Headers of the page
  ** See https://nuxtjs.org/api/configuration-head
  */
  server: {
    host: process.env.HOST || 'localhost',
    port: process.env.PORT || 9000,
  },
  publicRuntimeConfig: {
    backendUrl
  },
  head: {
    title: 'Speer',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
      { hid: 'description', name: 'description', content: 'Speer is a fast, privacy focused and open source communication app for various use cases.' },
      { property: 'og:title', content: 'Speer' },
      { property: 'og:description', content: 'Speer is a fast, privacy focused and open source communication app for various use cases.' },
      { property: 'og:image', content: '/icon.png' },
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com'},
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Roboto&display=swap' }
    ]
  },
  /*
  ** Global CSS
  */
  css: [
    '~/assets/main.css'
  ],
  /*
  ** Plugins to load before mounting the App
  ** https://nuxtjs.org/guide/plugins
  */
  plugins: [
    '~/plugins/axios.js',
    '~/plugins/drag.js',
  ],
  /*
  ** Auto import components
  ** See https://nuxtjs.org/api/configuration-components
  */
  components: true,
  /*
  ** Nuxt.js dev-modules
  */
  buildModules: [
  ],
  /*
  ** Nuxt.js modules
  */
  modules: [
    // Doc: https://axios.nuxtjs.org/usage
    '@nuxtjs/axios',
    '@nuxtjs/pwa',
  ],

  workbox: {
    importScripts: [
      'notifier.js',
      'share-target.js',
    ],
    preCaching: ['/svg/chat.svg', '/font/Roboto-Regular.ttf'],
    cleanupOutdatedCaches: true,
  },
  manifest: {
    name: 'Speer',
    short_name: 'Speer',
    lang: 'en',
    theme_color: '#ac9fbb',
    background_color: '#ac9fbb',
    display: 'standalone',
    start_url: '/',
    share_target: {
      action: "/share-target/",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "name",
        text: "description",
        url: "link",
        files: [
          {
            name: "files",
            accept: ["application/*", "audio/*", "example/*", "font/*", "image/*", "model/*", "text/*", "video/*", "message/*", "multipart/*"]
          },
        ]
      }
    }
  },
  /*
  ** Axios module configuration
  ** See https://axios.nuxtjs.org/options
  */
  axios: {
    baseURL: backendUrl,
  },
  /*
  ** Build configuration
  ** See https://nuxtjs.org/api/configuration-build/
  */
  build: {
  }
}
