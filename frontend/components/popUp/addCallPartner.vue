<template>
  <PopUp
    title="Add friend"
    icon="fa-user-plus"
    :buttons="buttons"
  >
    <h4 v-if="!friends.length">No user found with the specified email address.</h4>

    <div class="partner" v-for="friend in friends" :key="friend._id">
      <input type="radio" v-model="choosenPartner" :value="friend">

      <UserCard :user="friend" @click="choosenPartner = friend"/>
    </div>
  </PopUp>
</template>

<script>
import PopUp from '~/components/popUp/popUp'
import UserCard from '~/components/userCard'

export default {
  data() {
    return {
      choosenPartner: null,
      buttons: [
        {
          text: 'Cancel',
          action: () => this.$store.dispatch('popUp/close', 'addCallPartner')
        },
        {
          text: 'Add to call',
          action: () => {
            if(!this.choosenPartner) return

            this.$store.dispatch('call/addPartner', this.choosenPartner)
          }
        },
      ],
    }
  },
  computed: {
    friends() {
      let friends = Object.values(this.$store.state.friends)
        .filter( f => this.$store.state.call.partners.some(p => p != f) )

      return friends
    }
  },
  components: {
    UserCard,
    PopUp
  },
}
</script>

<style scoped>
h4 {
  font-size: 16px;
  padding: 20px;
  text-align: center;
}
.partner {
  display: flex;
  align-items: center;
}
.partner i {
  color: var(--accent-color);
  background: var(--accent-color);
}
</style>