<template>
  <div class="popUp">
    <div class="topper" @click="closeImg()"></div>

    <div v-if="loading" class="loading">
      <div>
        <i class="fas fa-image"/>
        <p class="name">{{$store.state.popUp.images[0].name}}</p>
        <p class="size">{{size}}</p>
        <i class="fas fa-spinner fa-pulse"/>
      </div>
    </div>
    <img v-show="!loading" ref="img">
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: true,
      size: '',
    }
  },
  mounted() {
    this.$store.state.sideBarDrag.stop()

    this.$refs.img.addEventListener('load', () => this.loading = false)
    this.openImg()
  },
  methods: {
    openImg() {
      this.loading = true
      this.size = this.getFileSize(this.$store.state.popUp.images[0].size)
      this.$refs.img.src = URL.createObjectURL(this.$store.state.popUp.images[0])
    },
    closeImg() {
      let remainingImages = this.$store.state.popUp.images.slice(1)
      this.$store.dispatch('popUp/set', {popUp: 'images', value: remainingImages})

      if(remainingImages.length)
        this.openImg()
    },
    getFileSize(size) {
      if(size < 1000000) return `${(size/1000).toFixed(2)} KB`
      if(size < 1000000000) return `${(size/1000000).toFixed(2)} MB`
      return `${(size/1000000000).toFixed(2)} GB`
    }
  },
  beforeDestroy() {
    if(this.$store.state.screenWidth <= 800)
      this.$store.state.sideBarDrag.start()
  },
}
</script>

<style scoped>
  .popUp {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    z-index: 100;
  }
  .loading {
    width: 400px;
    height: 600px;
    max-width: 90%;
    max-height: 90%;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--side-color);
    box-shadow: 0 0 30px var(--shadow-color);
    border-radius: 15px;
    z-index: 2;
  }
  .loading div {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 100%;
    padding: 0 5px;
    color: var(--accent-color);
    text-align: center;
  }
  .loading div .fa-image {
    margin-bottom: 10px;
    font-size: 80px;
  }
  .loading div .name {
    font-size: 18px;
    word-break: break-all;
  }
  .loading div .fa-spinner {
    margin-top: 10px;
    font-size: 20px;
  }
  img {
    max-width: 90%;
    max-height: 90%;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
    box-shadow: 0 0 30px var(--shadow-color);
    border-radius: 15px;
    overflow: hidden;
  }
  .pop-enter-active img, .pop-leave-active img, .pop-enter-active .loading, .pop-leave-active .loading {
    transition: var(--speed-normal);
  }
  .pop-enter img, .pop-leave-to img, .pop-enter .loading, .pop-leave-to .loading {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 100px));
  }
  .pop-enter-active .topper, .pop-leave-active .topper {
    transition: opacity var(--speed-normal);
  }
  .pop-enter .topper, .pop-leave-to .topper {
    opacity: 0;
  }
</style>