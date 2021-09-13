<template>
  <PopUp
    title="Feedback"
    icon="fa-comment-dots"
    @close="$store.dispatch('popUp/close', 'feedback')"
    :buttons="buttons"
  >
    <div class="feedback">
      <h4 class="intro">Help the development with an anonymous feedback!</h4>

      <div class="section type">
        <h4>Choose the type of your feedback:</h4>

        <label for="suggestion">Suggestion</label>
        <input type="radio" v-model="type" value="suggestion" id="suggestion">

        <label for="bug">Bug</label>
        <input type="radio" v-model="type" value="bug" id="bug">

        <label for="other">Other</label>
        <input type="radio" v-model="type" value="other" id="other">
        
        <p v-if="type == 'bug'" class="github">If you want to be able to track the state of your bug, consider opening an issue on <a href="https://github.com/horvbalint/speer/issues" target="_blank">GitHub</a> instead.</p>
      </div>


      <div class="section description">
        <h4>Please describe your {{correctType}}:</h4>

        <textarea v-model="description" maxlength="2000"/>
      </div>

      <div v-if="type == 'bug'" class="section steps-to-reproduce">
        <h4>Please provide steps to reproduce the issue:</h4>

        <div class="step" v-for="(step, index) in stepsToReproduce" :key="`step-${index}`">
          <span>{{index + 1}}.</span>
          <input v-model="stepsToReproduce[index]" @keyup.enter="addStep()" maxlength="500">
          <i class="fas fa-trash" @click="removeStep(index)"/>
        </div>

        <i class="fas fa-plus add" :disabled="stepsToReproduce.length == 9" @click="addStep()"/>
      </div>
    </div>
  </PopUp>
</template>

<script>
import PopUp from '~/components/popUp/popUp'

export default {
  data() {
    return {
      description: '',
      stepsToReproduce: [''],
      type: 'suggestion',
      buttons: [
        {
          text: 'Send',
          action: () => this.sendFeedback()
        }
      ]
    }
  },
  computed: {
    correctType() {
      switch(this.type) {
        case 'suggestion': return 'idea'
        case 'bug': return 'issue'
        case 'other': return 'suggestion'
      }
    }
  },
  methods: {
    addStep() {
      if(this.stepsToReproduce.length >= 9) return

      this.stepsToReproduce.push('')
    },
    removeStep(index) {
      this.stepsToReproduce.splice(index, 1)
    },
    sendFeedback() {
      if(!this.description.length)
        return errorBox('Empty feedback!', 'Please provide a description') 

      this.stepsToReproduce = this.stepsToReproduce.filter(step => step.trim().length)

      this.$axios.post('/feedback', {
        type: this.type,
        description: this.description,
        stepsToReproduce: this.stepsToReproduce
      })
        .then(() => {
          successBox('Feedback sent!', 'Thank you for your feedback!')
          this.$store.dispatch('popUp/close', 'feedback')
        })
        .catch( err => {
          console.error(err)
          errorBox('Error :/', 'Something went wrong, please try again later')
        })
    }
  },
  components: {
    PopUp
  }
}
</script>

<style scoped>
.feedback {
  margin: 0px 0;
  text-align: center;
}

.intro {
  margin-top: 10px;
  font-size: 18px;
}

.section {
  margin: 25px 0;
}
.section h4 {
  margin-bottom: 5px;
}

.type label {
  margin-left: 15px;
}
.type label:first-of-type {
  margin-left: 0;
}
.github {
  margin-top: 5px;
  color: var(--accent-color);
  font-size: 14px;
}
.github a {
  font-weight: bold;
}
.github a:link {
  color: var(--accent-color);
}
.github a:visited {
  color: var(--accent-color);
}
.github a:hover {
  color: var(--accent-color);
}

.description textarea {
  width: 100%;
  min-height: 100px;
  max-height: 400px;
  padding: 5px;
  color: var(--white);
  background: var(--side-color);
  border: none;
  border-radius: 5px;
  resize: vertical;
}

.steps-to-reproduce div {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 5px;
}
.steps-to-reproduce div span {
  margin-right: 5px;
}
.steps-to-reproduce div input {
  margin-right: 10px;
  flex: 1;
  padding: 7px;
  color: var(--white);
  background: var(--side-color);
  border: none;
  border-radius: 5px;
}
.steps-to-reproduce i:hover {
  color: var(--accent-color);
}
.steps-to-reproduce div i {
  color: var(--side-color);
  font-size: 18px;
}
.steps-to-reproduce .add {
  margin-top: 5px;
  color: var(--white);
  font-size: 20px;
}
.steps-to-reproduce .add[disabled] {
  color: grey !important;
}

.thanks {
  font-size: 18px;
}
</style>