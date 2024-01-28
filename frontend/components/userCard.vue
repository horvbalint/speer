<template>
  <div
  class="userCard"
  v-on="$listeners"
  :class="{
    online: $store.state.friends[user._id] && $store.state.friends[user._id].online,
    unread: friendText && friendText.unread,
    unavailable: !isTextAvailable
  }">
    <div class="avatar" :style="{'background-image': `url('${$config.backendUrl}/static/${user.avatar}')`}"></div>
    <div class="texts">
      <p class="name">{{ user.username }}</p>
      <p v-if="connecting" class="last-message">Connecting...</p>
      <p v-else-if="lastMessage" class="last-message">{{lastMessage.message}}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    user: {
      type: Object,
      default: () => ({})
    },
    connecting: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    friendText() {
      if(!this.$store.state.partners[this.$props.user._id]) return null

      return this.$store.state.partners[this.$props.user._id].text
    },
    lastMessage() {
      if(!this.friendText) return null

      for(let i = this.friendText.messages.length-1; i >= 0; i--) {
        if(this.friendText.messages[i].sender !== this.$store.state.user._id)
          return this.friendText.messages[i]
      }
    },
    isTextAvailable() {
      return this.$store.state.isConnected || this.$store.state.partners[this.$props.user._id]
    },
  },
}
</script>

<style scoped>
.userCard {
  display: flex;
  align-items: center;
  padding: 10px;
  cursor: pointer;
  transition: var(--speed-fast);
}
.userCard:hover {
  padding-left: 20px;
}
.avatar {
  width: 50px;
  height: 50px;
  flex-shrink: 0;
  border-radius: 100%;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  background-color: var(--bg-color);
  margin-right: 10px;
  border: 4px solid var(--red);
}
.online .avatar {
  border: 4px solid var(--green);
}
.texts {
  overflow: hidden;
}
.name {
  font-size: var(--p-size);
}
.last-message {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--accent-color)
}
.unread .last-message {
  color: var(--white)
}
.unavailable .avatar {
  border: 4px solid var(--grey);
}

@media screen and (max-width: 600px) {
  .userCard:hover {
    padding-left: 10px;
  }
}
</style>
