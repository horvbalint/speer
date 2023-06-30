<script setup lang="ts">
const email = ref('')
const username = ref('')
const password = ref('')
const passwordAgain = ref('')

function register() {
  $api('/register', {
    method: 'post',
    body: {
      email: email.value,
      username: username.value,
      password: password.value,
    },
  })
    .then(() => { navigateTo('/login') })
    .catch(err => console.error(err))
}
</script>

<template>
  <div class="h-full flex items-center justify-center">
    <div class="max-w-md flex flex-col gap-1">
      <u-input v-model="email" placeholder="Email" />
      <u-input v-model="username" placeholder="Username" />
      <u-input v-model="password" type="password" placeholder="Password" />
      <u-input v-model="passwordAgain" type="password" placeholder="Password again" />

      <u-button class="mt-4" @click="register()">
        Register
      </u-button>
      <nuxt-link to="/login">
        or login
      </nuxt-link>
    </div>
  </div>
</template>
