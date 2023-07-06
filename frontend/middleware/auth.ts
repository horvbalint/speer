import type { MeUser } from '~/../backend/bindings/MeUser'

export default defineNuxtRouteMiddleware(async () => {
  try {
    const me = await $api<MeUser>('/me')
    getAuthUser().value = me

    await $ws.statePromise
  }
  catch (err) {
    console.error(err)
    return navigateTo('/login')
  }
})
