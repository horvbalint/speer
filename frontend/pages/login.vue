<script setup lang="ts">
const email = ref('horvbalint99@gmail.com')
const password = ref('test')

function login() {
  $api('/login', {
    method: 'post',
    body: {
      email: email.value,
      password: password.value,
    },
  })
    .then(() => { navigateTo('/') })
    .catch(err => console.error(err))
}
</script>

<template>
  <div class="h-full flex items-center justify-center">
    <div class="max-w-md flex flex-col gap-1">
      <u-input v-model="email" placeholder="Email" />
      <u-input v-model="password" type="password" placeholder="Password" />

      <u-button class="mt-4" @click="login()">
        Login
      </u-button>

      <nuxt-link to="/register">
        or register
      </nuxt-link>
    </div>
  </div>
</template>
