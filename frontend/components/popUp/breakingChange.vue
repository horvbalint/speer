<template>
  <PopUp
    title="Breaking change"
    icon="fa-code-branch"
    :buttons="buttons"
  >
    <p>There was a breaking change since you used Speer the last time. You need to update it so that you can continue using it without issues.</p>

    <p class="small">Updating takes a moment only.</p>
  </PopUp>
</template>

<script>
import PopUp from '~/components/popUp/popUp'
import PackageJSON from '~/package.json'

export default {
  data() {
    return {
      buttons: [
        {
          text: 'Update',
          action: () => {
            localStorage['showChangelog'] = PackageJSON.version
            location.reload()
          }
        }
      ],
    }
  },
  components: {
    PopUp
  }
}
</script>

<style scoped>
div {
  padding: 10px 5px;
}
div p {
  text-align: center;
}
div .small {
  text-align: center;
  margin: 10px 0;
  font-size: 14px;
}
</style>
