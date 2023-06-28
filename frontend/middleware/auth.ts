import type { MeUser } from '~/../backend/bindings/MeUser'

export default defineNuxtRouteMiddleware(async () => {
  try {
    const me = await $api<MeUser>('/me')
    useAuthUser().value = me
  }
  catch (err) {
    console.error(err)
    return navigateTo('/login')
  }
})
