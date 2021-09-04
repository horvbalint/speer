
export default {
  srcDir: 'frontend/',
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
    port: 9000,
  },
  head: {
    title: 'Speer',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
      { hid: 'description', name: 'description', content: 'Speer is a fast, privacy focused and open source communication app for various use cases.' }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css' }
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
    cleanupOutdatedCaches: true
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
    baseURL: process.env.NODE_ENV == 'development' ? 'http://localhost:9001' : 'https://speer.fun:9001',
    // baseURL: 'http://localhost:9001',
  },
  /*
  ** Build configuration
  ** See https://nuxtjs.org/api/configuration-build/
  */
  build: {
  }
}
