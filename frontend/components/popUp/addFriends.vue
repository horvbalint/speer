<template>
  <PopUp
    title="Add friend"
    icon="fa-user-plus"
    @close="$store.dispatch('popUp/close', 'addFriends')"
  >
    <div class="search">
      <input class="search-input" v-model="email" type="text" placeholder="Search by email address" @keyup.enter="search()">
      <i class="fas fa-search search-btn" @click="search()"/>
    </div>

    <h4 v-if="!result">No user found with the specified email address.</h4>
    <UserCard
      v-if="result"
      :key="result._id"
      :user="result"
      @click="addPartner(result)"
    />
  </PopUp>
</template>

<script>
import PopUp from '~/components/popUp/popUp'
import UserCard from '~/components/userCard'

export default {
  data() {
    return {
      email: '',
      result: null,
    }
  },
  methods: {
    addPartner(user) {
      this.$axios.$post(`/request/${user._id}`)
        .then( () => this.$store.dispatch('popUp/close', 'addFriends') )
        .catch( err => {
          console.error(err)
          errorBox('Error!', 'Something went wrong, try again later')
        })
    },
    search() {
      if(!this.email.length) {
        this.result = null
        return
      }

      this.$axios.$get(`/user/${this.email}`)
        .then( result => this.result = result )
        .catch( err => {
          console.error(err)
          errorBox('Error!', 'Something went wrong, try again later')
        })
    }
  },
  components: {
    UserCard,
    PopUp
  },
}
</script>

<style scoped>
.search {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 30px 0 20px 0;
}
.search-input {
  width: 400px;
  height: 40px;
  border: none;
  border-radius: 50px 0 0 50px;
  padding: 5px 10px;
  font-size: 14px;
}
.search-btn {
  height: 40px;
  border-radius: 0 50px 50px 0;
  padding: 10px 15px;
  background: var(--side-color);
  font-size: 20px;
}
h4 {
  font-size: 16px;
  padding: 20px;
  text-align: center;
}
</style>