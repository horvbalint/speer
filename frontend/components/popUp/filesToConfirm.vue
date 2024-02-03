<template>
  <PopUp
    title="Confirm action"
    icon="fas fa-file"
    :buttons="buttons"
  >
    <div class="img" :style="{'background-image': `url('${$config.backendUrl}/static/${$store.getters.partnerFriend.avatar}')`}"/>
    <p class="description">Do you want to send these files to '{{$store.getters.partnerFriend.username}}'?</p>

    <div class="file" v-for="(file, index) in $store.state.filesToConfirm" :key="`${file}-${index}`">
      <p>Filename: <span>{{file.name}}</span></p>
      <p>Size: <span>{{getFileSize(file.size)}}</span></p>
    </div>
  </PopUp>
</template>

<script>
import PopUp from '~/components/popUp/popUp'

export default {
  data() {
    return {
      acceptAll: false,
      preview: false,
      buttons: [
        {
          text: 'Cancel',
          action: () => {
            this.$store.dispatch('setFilesToConfirm', [])
            this.$store.dispatch('popUp/close', 'filesToConfirm')
          }
        },
        {
          text: 'Send',
          action: () => {
            this.$store.dispatch('sendFiles', {files: this.$store.state.filesToConfirm})
            this.$store.dispatch('setFilesToConfirm', [])
            this.$store.dispatch('popUp/close', 'filesToConfirm')
          }
        }
      ]
    }
  },
  methods: {
    getFileSize(size) {
      if(size < 1000000) return `${(size/1000).toFixed(2)} KB`
      if(size < 1000000000) return `${(size/1000000).toFixed(2)} MB`
      return `${(size/1000000000).toFixed(2)} GB`
    }
  },
  components: {
    PopUp
  }
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
.description {
  text-align: center;
  margin-bottom: 20px;
}
.file {
  margin-bottom: 20px;
}
.file p {
  text-align: center;
  margin: 3px 0;
  font-weight: bold;
}
.file p span {
  font-weight: normal;
}
.option {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
}
.option input {
  margin-right: 5px;
}
@media screen and (max-width: 600px) {
  .img {
    width: 130px;
    height: 130px;
  }
}
</style>
