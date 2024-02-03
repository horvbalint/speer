<template>
  <PopUp
    title="Friend request"
    icon="fa-user-plus"
    :buttons="buttons"
    :closeWithSwipe="false"
    :closeWithTopper="false"
  >
    <div class="img" :style="{'background-image': `url('${$config.backendUrl}/static/${$store.state.requests[0].avatar}')`}"/>

    <div class="contact">
      <p>Username: <span>{{$store.state.requests[0].username}}</span></p>
      <p>Email: <span>{{$store.state.requests[0].email}}</span></p>
    </div>

    <p style="margin-bottom: 20px">Do you want to accept it?</p>
  </PopUp>
</template>

<script>
import UserCard from '~/components/userCard'
import PopUp from '~/components/popUp/popUp'

export default {
  data() {
    return {
      term: '',
      results: [],
      buttons: [
        {
          text: '<i class="fas fa-times"/>',
          action: () => this.$store.dispatch('declineRequest')
        },
        {
          text: '<i class="fas fa-check"/>',
          action: () => this.$store.dispatch('acceptRequest')
        }
      ]
    }
  },
  components: {
    UserCard,
    PopUp
  },
}
</script>

<style scoped>
.img {
  width: 100px;
  height: 100px;
  border-radius: 100%;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  border: 3px solid var(--accent-color);
  margin: 15px auto 10px;
  cursor: pointer;
  position: relative;
}
.contact {
  margin: 15px 0 20px;
}
.contact p {
  text-align: center;
  margin: 3px 0;
  font-weight: bold;
}
.contact p span {
  font-weight: normal;
}
p {
  text-align: center;
  margin-bottom: 20px;
}
@media screen and (max-width: 600px) {
  .img {
    width: 130px;
    height: 130px;
  }
}
</style>
