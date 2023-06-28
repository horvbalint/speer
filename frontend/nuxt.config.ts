// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: true },

  devServer: {
    port: 9000,
  },

  runtimeConfig: {
    public: {
      apiURL: 'http://localhost:9001/',
    },
  },

  css: ['~/assets/main.scss'],
  modules: ['nuxt-icon', '@nuxthq/ui'],
})
