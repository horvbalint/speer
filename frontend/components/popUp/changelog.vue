<template>
  <PopUp
    :title="$store.state.popUp.changelog.title"
    icon="fa-code-branch"
    @close="$store.dispatch('popUp/close', 'changelog')"
    :buttons="buttons"
  >
    <div v-for="(log, version) in $store.state.popUp.changelog.log" :key="version" :class="log.type">
      <h3>{{version}} - {{log.title}}</h3>

      <template v-if="log.changes.length">
        <h4>Changes:</h4>
        <ul>
          <li v-for="(change, index) in log.changes" :key="`change-${index}`">{{change}}</li>
        </ul>
      </template>

      <template v-if="log.notes.length">
        <h4>Notes:</h4>
        <ul>
          <li v-for="(note, index) in log.notes" :key="`note-${index}`">{{note}}</li>
        </ul>
      </template>
    </div>
  </PopUp>
</template>

<script>
import PopUp from '~/components/popUp/popUp'

export default {
  data() {
    return {
      buttons: [
        {
          text: 'Close',
          action: () => this.$store.dispatch('popUp/close', 'changelog')
        }
      ]
    }
  },
  components: {
    PopUp
  }
}
</script>

<style scoped>
div {
  margin: 25px 0 15px;
}
div h3 {
  margin-bottom: 10px;
}
div h4 {
  margin: 5px 0 5px 10px;
}
div ul {
  margin-left: 35px;
}
div li {
  margin: 3px 0;
  word-break: break-all;
  user-select: text;
}
</style>