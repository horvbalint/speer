<template>
  <div class="popUp">
    <div class="topper" @click="close()" ref="topper"></div>

    <div class="pop-up" ref="popUp" :class="{withButtons: buttons && buttons.length}">
      <div ref="header" class="title" v-if="title">
        <h3>{{title}}</h3>
        <hr>
        <i v-if="icon" :class="`fas ${icon}`"/>
      </div>
      
      <div class="content">
        <slot/>
      </div>

      <slot name="buttons">
        <div v-if="buttons" class="buttons">
          <div
            v-for="button in buttons"
            :key="button.text" 
            class="button"
            @click="button.action()"
            v-html="button.text"
          >
          </div>
        </div>
      </slot>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    title: String,
    icon: String,
    buttons: Array,
    noClose: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      term: '',
      results: [],
    }
  },
  mounted() {
    if(this.$store.state.sideBarDrag)
      this.$store.state.sideBarDrag.stop()

    if(this.$store.state.screenWidth <= 600) {
      this.$store.dispatch('setPopUpDrag', new Drag({
        target: this.$refs.header,
        direction: 'y',
        range: {from: 0, to: 100},
        multiplier: 1/(this.$refs.popUp.clientHeight/100),
        onStart: () => {
          this.$refs.popUp.style.willChange = 'transform'
          this.$refs.topper.style.willChange = 'opacity'
        },
        setter: percent => {
          this.$refs.popUp.style.transform = `translateY(${percent}%)`
          this.$refs.topper.style.opacity = (100-percent) / 100
        },
        onEnd: percent => {
          if(this.$props.noClose) return 0

          if(percent < 30) return 0
          else return 100
        },
        onDone: percent => {
          if(percent == 0) return

          this.$refs.popUp.style.willChange = 'auto'
          this.$refs.topper.style.willChange = 'auto'
          this.close()
        }
      }))
    }
  },
  methods: {
    close() {
      if(this.$store.state.screenWidth <= 600)
        this.$store.state.popUpDrag.stop()

      if(this.$store.state.screenWidth <= 800)
        this.$store.state.sideBarDrag.start()

      this.$emit('close')
    }
  },
  beforeDestroy() {
    if(this.$store.state.screenWidth <= 600)
      this.$store.state.popUpDrag.stop()

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
  .pop-up {
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    min-width: 300px;
    min-height: 200px;
    max-width: min(60%, 400px);
    max-height: 80%;

    background: var(--bg-color);
    border-radius: 15px;
    box-shadow: 0 0 30px var(--shadow-color);
    padding-top: 10px;
    overflow: hidden;

    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
  }
  .title {
    background: var(--bg-color);
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 10px;
  }
  .title hr {
    display: none;
  }
  .title h3 {
    display: inline;
    font-size: 26px;
    margin-left: 0;
  }
  .title i {
    cursor: default;
    font-size: 30px;
    margin-right: 0px;
    margin-left: 20px;
  }
  .content {
    overflow: auto;
    padding: 0 10px;
    /* margin-bottom: -54px; */
    /* padding-bottom: 54px */
  }
  .buttons {
    border-top: 2px solid #5d5465;
    display: flex
  }
  .button {
    height: 45px;
    line-height: 45px;
    text-align: center;
    width: 100%;
    cursor: pointer;
    font-size: 24px;
    transition: var(--speed-fast);
    border-left: 2px solid #5d5465;
  }
  .button:first-child {
    border: none;
  }
  .button:hover {
    background: #5d5465;
  }

  .pop-enter-active .pop-up, .pop-leave-active .pop-up {
    transition: var(--speed-normal);
  }
  .pop-enter .pop-up, .pop-leave-to .pop-up {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 100px));
  }

  .pop-enter-active .topper, .pop-leave-active .topper {
    transition: opacity var(--speed-normal);
  }
  .pop-enter .topper, .pop-leave-to .topper {
    opacity: 0;
  }

  @media screen and (max-width: 600px) {
    .pop-up {
      width: 100%;
      min-width: none;
      min-height: 40%;
      max-width: none;
      max-height: 80%;
      overflow: auto;

      border-radius: 15px 15px 0 0;
      padding-top: 0px;

      position: fixed;
      top: unset;
      left: unset;
      bottom: 0;

      transform: translateY(0);
      z-index: 2;
    }

    .title {
      justify-content: space-between;
      padding-bottom: 7px;
      margin-bottom: 0px;
      border-bottom: 2px solid #5d5465;
      position: relative;
      padding-top: 15px;
      height: 59px;
    }
    .title h3 {
      font-size: 24px;
      margin-left: 10px;
    }
    .title i {
      font-size: 28px;
      margin-right: 10px;
    }
    .title hr {
      position: absolute;
      top: 6px;
      left: 50%;
      transform: translateX(-50%);
      display: block;
      width: 75px;
      height: 4px;
      color: var(--white);
      background: var(--white);
      border-radius: 4px;
    }
    .button {
      height: 54px;
      line-height: 54px;
    }

    .pop-enter .pop-up, .pop-leave-to .pop-up {
      opacity: 0;
      bottom: -100%;
      transform: translateY(100%);
    }
  }
</style>