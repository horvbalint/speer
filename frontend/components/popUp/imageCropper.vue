<template>
  <PopUp
    title="Adjust the image"
    icon="fa-pen-to-square"
    @close="close()"
    :buttons="buttons"
    maximized
  >
    <div class="cropper-wrapper">
      <ImageCropper
        ref="imageCropper"
        :img="$store.state.popUp.imageCropper.image"
        :ratio="1"
        lineColor="#ac9fbb"
        maskColor="rgba(62, 57, 67, 0.9)"
        minWidth="200"
        minHeight="200"
        ellipsis-mask
      />
    </div>
  </PopUp>
</template>

<script>
import ImageCropper from '~/components/imageCropper'
import PopUp from '~/components/popUp/popUp'

export default {
  data() {
    return {
      buttons: [
        {
          text: 'Close',
          action: () => this.close()
        },
        {
          text: 'Save',
          action: async () => {
            let img = await this.$refs.imageCropper.getImage()
            this.$store.state.popUp.imageCropper.callback(img)
            this.close()
          }
        }
      ]
    }
  },
  methods: {
    close() {
      this.$store.dispatch('popUp/close', 'imageCropper')
    }
  },
  components: {
    PopUp,
    ImageCropper
  }
}
</script>

<style scoped>
  .cropper-wrapper {
    height: 100%;
    padding: 10px 0;
  }
</style>