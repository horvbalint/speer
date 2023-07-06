// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: true },

  devServer: {
    port: 9000,
  },

  alias: {
    'simple-peer': 'simple-peer/simplepeer.min.js',
  },

  runtimeConfig: {
    public: {
      apiURL: 'http://localhost:9001/',
      wsURL: 'ws://localhost:9001/ws/',
    },
  },

  css: ['~/assets/main.scss'],
  modules: ['nuxt-icon', '@nuxthq/ui'],
})
