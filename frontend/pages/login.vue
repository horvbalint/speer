<template>
  <div class="page">
    <div class="login">
      <h1>Speer</h1>
      <div class="main" v-if="mode == 'login'">
        <input v-model="user.email" type="email" placeholder="E-mail" key="login-email">
        <input v-model="user.password" @keyup.enter="login()" type="password" placeholder="Password" key="login-password">

        <p v-if="resend" class="resend" @click="resendConfirmation()">Did not receive an email?</p>

        <div class="buttons">
          <button @click="login()" :disabled="loading">Log-in</button>
          <p @click="mode = 'register'">or register</p>
        </div>
      </div>

      <div class="main" v-else>
        <input v-model="user.email" type="email" placeholder="Email" key="register-email" autocomplete="email">
        <input v-model="user.username" type="text" maxlength="25" placeholder="Username" key="register-username">
        <input v-model="user.password" type="password" placeholder="Password" key="register-password">
        <input v-model="secondPassword" @keyup.enter="register()" type="password" placeholder="Password again" key="register-second">

        <div class="buttons">
          <button @click="register()" :disabled="loading">Register</button>
          <p @click="mode = 'login'">or log-in</p>
        </div>
      </div>
    </div>

    <a class="learn-more" href="https://github.com/horvbalint/speer" target="_blank">click here to learn more about Speer</a>
  </div>
</template>

<script>
export default {
  layout: 'login',
  data() {
    return {
      mode: 'login',
      user: {
        email: '',
        password: '',
        username: ''
      },
      secondPassword: '',
      loading: false,
      resend: false,
    }
  },
  methods: {
    register() {
      if(!this.user.email || !this.user.username || !this.user.password || !this.secondPassword) return errorBox('Error!', 'Fill in every input field')
      if(this.user.password !== this.secondPassword) return errorBox('Error!', 'Passwords do not match')
      if(!(/^[A-Za-z0-9 _]+$/).test(this.user.username)) return errorBox('Error!', 'Username can only contain letters, numbers, spaces and underscores')
      if(this.user.username.length > 25) return errorBox('Error!', 'Username can not be longer than 25 characters')
      this.loading = true

      this.$axios.$post('/register', this.user)
        .then( () => {
          if(process.env.NODE_ENV == 'development')
            alertBox('Check the backend\'s logs!', 'Please click the url in the logs to finalize the registration')
          else
            alertBox('Check your mailbox!', 'Please follow the instructions in the email sent to your address to finalize the registration')

          this.mode = 'login'
        })
        .catch( err => {
          console.error(err)

          if(err.response.data == 'Email in use')
            errorBox('Email already in use!', 'Try logging in')
          else if(err.response.data == 'Invalid chars')
            errorBox('Invalid characters', 'Username can only contain letters, numbers, spaces and underscores')
          else
            errorBox('Uh-oh!', 'Something went wrong, try again later')
        })
        .finally( () => this.loading = false )
    },
    login() {
      if(!this.user.email || !this.user.password) return errorBox('Error!', 'Fill in every input field')
      this.loading = true

      this.$axios.$post('/login', this.user)
        .then( () => this.$router.push('/') )
        .catch( err => {
          console.error(err)

          switch(err.response.data) {
            case 'Incorrect credentials': {
              errorBox('Incorrect credentials!', 'Email or password is not correct')
              break
            }
            case 'Email not confirmed': {
              errorBox('Email not confirmed!', 'Please follow the instructions in the email sent to your address to finalize the registration')
              this.resend = true
              break
            }
            case 'User deactivated': {
              errorBox('User deactivated!', 'You can not use this profile anymore')
              break
            }
            default: {
              errorBox('Uh-oh!', 'Something went wrong, try again later')
            }
          }

          this.loading = false
        })
    },
    resendConfirmation() {
      this.$axios.$post('/resendConfirmation/' + this.user.email)
        .then( () => {
          this.resend = false

          if(process.env.NODE_ENV == 'development')
            alertBox('Check the backend\'s logs!', 'Please click the url in the logs to finalize the registration')
          else
            alertBox('Confirmation email sent!', 'Please follow the instructions in the email sent to your address to finalize the registration')
        })
        .catch( err => {
          this.resend = false

          console.error(err)
          errorBox('Uh-oh!', 'Something went wrong, try again later')
        })
    }
  },
}
</script>

<style scoped>
.login {
  position: fixed;
  top: 50%;
  left: 50%;
  width: 90%;
  max-width: 400px;
  transform: translate(-50%, -50%);

  background: var(--accent-color);
  padding: 20px;
  border-radius: 10px;

  display: flex;
  flex-direction: column;
  align-items: center;
}
h1 {
  text-align: center;
  font-size: 50px;
  margin-bottom: 30px;
}
input {
  display: block;
  background: var(--white);
  border: 2px solid var(--bg-color);
  border-radius: 10px;
  padding: 8px 10px;
  margin: 2px;
}
.buttons {
  margin-top: 30px;
}
.buttons button {  
  display: block;
  margin: 0 auto 10px;
  text-align: center;
  padding: 10px 0;
  width: 90%;
  
  border-radius: 5px;
  background: var(--white);
  border: 2px solid var(--bg-color);

  cursor: pointer;
  transition: var(--speed-normal);
}
.buttons button:hover {
  background: var(--bg-color);
  color: var(--white);
}
.buttons p {
  text-align: center;
  text-decoration: underline;
  cursor: pointer;
}
.resend {
  text-decoration: underline;
  text-align: center;
  cursor: pointer;
  margin-top: 5px;
}
.learn-more {
  display: block;
  width: 100%;
  position: fixed;
  bottom: 10px;
  text-align: center;
  color: var(--accent-color);
  font-size: 18px;
  z-index: -1;
}
.learn-more:link {
  color: var(--accent-color);
}
.learn-more:visited {
  color: var(--accent-color);
}
.learn-more:hover {
  color: var(--accent-color);
}
.learn-more:active {
  color: var(--accent-color);
}
</style>