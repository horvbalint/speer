<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const authUser = useAuthUser()

function logout() {
  $api('/logout', { method: 'post' })
    .then(() => { navigateTo('/login') })
    .catch(err => console.error(err))
}
</script>

<template>
  <div>
    <p>Logged in as: {{ authUser!.username }}</p>

    <u-button @click="logout()">
      Log out
    </u-button>
  </div>
</template>
