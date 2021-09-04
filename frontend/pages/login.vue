<template>
  <div class="login" v-if="!confirming">
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
      <input v-model="user.email" type="email" placeholder="E-mail" key="register-email">
      <input v-model="user.username" type="text" placeholder="Username" key="register-username">
      <input v-model="user.password" type="password" placeholder="Password" key="register-password">
      <input v-model="secondPassword" @keyup.enter="register()" type="password" placeholder="Password again" key="register-second">

      <div class="buttons">
        <button @click="register()" :disabled="loading">Register</button>
        <p @click="mode = 'login'">or log-in</p>
      </div>
    </div>

  </div>

  <div v-else class="confirm-popup">
    <h1>Speer</h1>
    <p>Checking confirmation success</p>
    <i class="fas fa-spinner fa-pulse"/>
  </div>
</template>

<script>
export default {
  layout: 'login',
  data() {
    return {
      confirming: false,
      confirmStart: 0,
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
  mounted() {
    if(this.$route.query.confirmToken) {
      this.confirming = true
      this.confirmStart = Date.now()

      this.$axios.$post(`/confirm/${this.$route.query.confirmToken}`)
        .then( () => {
          let delta = Date.now() - this.confirmStart

          setTimeout( () => {
            this.confirming = false
            successBox("Email confirmed!", "You can now log in")

            this.$router.push('/login')
          }, Math.max(1500 - delta, 0) )
        })
        .catch( () => {
          let delta = Date.now() - this.confirmStart

          setTimeout( () => {
            this.confirming = false
            errorBox("Confirmation failed", "Please try again")

            this.$router.push('/login')
          }, Math.max(1500 - delta, 0) )
        })
    }
  },
  methods: {
    register() {
      if(!this.user.email || !this.user.password || !this.secondPassword) return errorBox('Error!', 'Fill in every input field')
      if(this.user.password !== this.secondPassword) return errorBox('Error!', 'Passwords do not match')
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
.confirm-popup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  background: var(--accent-color);
  padding: 20px;
  border-radius: 10px;
  width: 90%;
  max-width: 400px;
}
.confirm-popup p {
  margin-bottom: 20px;
  font-size: 25px;
}
.confirm-popup i {
  font-size: 30px;
  cursor: default;
}
.resend {
  text-decoration: underline;
  text-align: center;
  cursor: pointer;
  margin-top: 5px;
}
</style>