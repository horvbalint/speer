<template>
  <div class="sideBar closed">
    <div class="top">
      <h1>Speer</h1>
    </div>

    <div v-if="!Object.keys($store.state.friends).length" class="no-friends">
      <i class="fas fa-users"/>
      <p>You have no friends yet,</p>
      <p>add them using the button below</p>
    </div>

    <div v-else class="main">
      <UserCard
        v-for="user in onlines"
        :key="user._id"
        :user="user"
        :connecting="$store.state.connecting.text == user._id"
        @click="openPartner(user)"
      />
      <UserCard
        v-for="user in offlines"
        :key="user._id"
        :user="user"
        @click="pingUser(user)"
      />
    </div>

    <div class="bottom" @click="$store.dispatch('popUp/open', 'addFriends')">
      <h2>Add friend <i class="fas fa-user-plus"></i></h2>
    </div>
  </div>  
</template>

<script>
import UserCard from '~/components/userCard'

export default {
  computed: {
    onlines() {
      return Object.values(this.$store.state.friends).filter(user => user.online)
    },
    offlines() {
      return Object.values(this.$store.state.friends).filter(user => !user.online)
    }
  },
  methods: {
    openPartner(user) {
      if(this.$store.state.connecting.text) return

      if(!this.$store.state.isConnected && !this.$store.state.partners[user._id]) {
        warningBox('You are not connected to the server!', 'Try to reload the page and check your network connection', {
          text: 'Reload',
          action: () => location.reload()
        })

        return
      }

      this.$store.dispatch('openPartner', user._id)
        .then( () => this.$emit('close') )
        .catch( err => console.error(err) )
    },
    pingUser(user) {
      this.$store.dispatch('popUp/set', {popUp: 'ping', value: user})
    },
  },
  components: {
    UserCard,
  },
}
</script>

<style scoped>
.sideBar {
  background: var(--side-color);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-radius: 0 20px 20px 0;
  box-shadow: 0 0 20px 0px var(--shadow-color);
  overflow: hidden;
}
.top {
  background: var(--bg-color);
  padding: 10px;
}
h1 {
  text-align: center;
  font-size: var(--h1-size);
  letter-spacing: 2px;
}
.main {
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
}
.no-friends {
  text-align: center;
  color: var(--accent-color);
  transform: translateY(-75px);
}
.no-friends i {
  font-size: 65px;
  margin-bottom: 15px;
}
.no-friends p:first-of-type {
  font-size: 20px;
}
.bottom {
  background: var(--bg-color);
  text-align: center;
  cursor: pointer;
  padding: 15px;
  transition: var(--speed-normal)
}
.bottom h2 {
  font-size: var(--h2-size);
  transition: var(--speed-normal)
}
.bottom i {
  margin-left: 10px;
}
.bottom:hover {
  background: var(--accent-color);
}

@media screen and (max-width: 800px) {
  .sideBar{
    transition: box-shadow var(--speed-normal), border-radius var(--speed-normal);
  }
  .closed {
    box-shadow: none;
  }
}

@media screen and (max-width: 600px) {
  .open {
    border-radius: 0;
  }
  .no-friends i {
    font-size: 75px;
    margin-bottom: 20px;
  }
  .no-friends p:first-of-type {
    font-size: 23px;
  }
  .no-friends p:last-of-type {
    font-size: 18px;
  }
}
</style>
