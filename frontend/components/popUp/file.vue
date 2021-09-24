<template>
  <PopUp
    title="File request"
    icon="fas fa-file"
    :buttons="buttons"
  >
    <div class="img" :style="{'background-image': `url('${$store.state.backendURL}/static/${$store.state.popUp.file.sender.avatar}')`}"/>
    <p class="description">{{$store.state.popUp.file.sender.username}} wants to send you a file!</p>

    <div class="file">
      <p>Filename: <span>{{$store.state.popUp.file.file.name}}</span></p>
      <p>Size: <span>{{getFileSize($store.state.popUp.file.file.size)}}</span></p>
    </div>

    <div v-if="$store.state.popUp.file.file.type.startsWith('image')" class="option">
      <input type="checkbox" id="preview" v-model="preview">
      <label for="preview">Just open the image (won't download)</label>
    </div>

    <div class="option">
      <input type="checkbox" id="acceptAll" v-model="acceptAll">
      <label for="acceptAll">Accept every file from '{{$store.state.popUp.file.sender.username}}' in this session</label>
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
          text: 'Decline',
          action: () => this.$store.dispatch('declineFile')
        },
        {
          text: 'Accept',
          action: () => {
            if(this.acceptAll)
              this.$store.dispatch('setAcceptAllInSession', {
                partnerId: this.$store.state.popUp.file.sender._id,
                value: {preview: this.preview}
              })
              
            this.$store.dispatch('acceptFile', this.preview)
          }
        }
      ]
    }
  },
  methods: {
    getFileSize(size) {
      if(size < 1_000_000) return `${(size/1_000).toFixed(2)} KB`
      if(size < 1_000_000_000) return `${(size/1_000_000).toFixed(2)} MB`
      return `${(size/1_000_000_000).toFixed(2)} GB`
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