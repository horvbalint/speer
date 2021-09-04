<template>
  <div class="popUp">
    <div class="topper" @click="$store.dispatch('popUp/close', 'image')"></div>

    <img ref="img"/>
  </div>
</template>

<script>
export default {
  mounted() {
    this.$store.state.sideBarDrag.stop()
    this.$refs.img.src = URL.createObjectURL(this.$store.state.popUp.image)
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
  .pop-enter-active img, .pop-leave-active img {
    transition: var(--speed-normal);
  }
  .pop-enter img, .pop-leave-to img {
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