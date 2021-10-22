<template>
  <div class="popUp">
    <div class="topper" @click="$store.dispatch('popUp/close', 'video')"></div>

    <div v-if="loading" class="loading">
      <div>
        <i class="fas fa-film"/>
        <p class="name">{{$store.state.popUp.video.name}}</p>
        <p class="size">{{size}}</p>
        <i class="fas fa-spinner fa-pulse"/>
      </div>
    </div>
    <video v-show="!loading" ref="video" autoplay controls/>
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
  created() {
    this.size = this.getFileSize(this.$store.state.popUp.video.size)
  },
  mounted() {
    this.$store.state.sideBarDrag.stop()

    this.$refs.video.addEventListener('loadeddata', () => this.loading = false)
    this.$refs.video.src = URL.createObjectURL(this.$store.state.popUp.video)
  },
  methods: {
    getFileSize(size) {
      if(size < 1_000_000) return `${(size/1_000).toFixed(2)} KB`
      if(size < 1_000_000_000) return `${(size/1_000_000).toFixed(2)} MB`
      return `${(size/1_000_000_000).toFixed(2)} GB`
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
  .loading div .fa-film {
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
  video {
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
  .pop-enter-active video, .pop-leave-active video, .pop-enter-active .loading, .pop-leave-active .loading {
    transition: var(--speed-normal);
  }
  .pop-enter video, .pop-leave-to video, .pop-enter .loading, .pop-leave-to .loading {
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