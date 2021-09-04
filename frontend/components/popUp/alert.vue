<template>
  <div v-if="alerts.length" class="alert-wrapper">
    <div
      v-for="(alert, index) in alerts"
      :key="`alert-${index}`"
      class="alert"
      :class="{
        error: alert.type === 'error',
        success: alert.type === 'success',
        warning: alert.type === 'warning',
      }"
      >
      <i class="fas fa-times" @click="closeAlert(alert)"/>

      <h4>{{alert.title}}</h4>

      <div class="bottom">
        <pre>{{alert.description}}</pre>
        <button v-if="alert.button" @click="alert.button.action()">{{alert.button.text}}</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      alerts: []
    }
  },
  mounted() {
    window.alertBox = (title, desc, button) => this.openAlert(title, desc, 'alert', button)
    window.successBox = (title, desc, button) => this.openAlert(title, desc, 'success', button)
    window.warningBox = (title, desc, button) => this.openAlert(title, desc, 'warning', button)
    window.errorBox = (title, desc, button) => this.openAlert(title, desc, 'error', button)
  },
  methods: {
    openAlert(title, description, type = "alert", button) {
      let alert = {
        title,
        description,
        type,
      }

      if(type != 'error')
        alert.timeOut = setTimeout(() => this.closeAlert(alert), 6000)

      if(button)
        alert.button = button

      this.alerts.push(alert)
    },
    closeAlert(alert) {
      if(alert.timeOut)
        clearTimeout(alert.timeOut)

      this.alerts = this.alerts.filter(a => a != alert)
    }
  }
}
</script>

<style scoped>
.alert-wrapper {
  position: fixed;
  left: 0;
  bottom: 0;
  min-width: 400px;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 0 5px;
  z-index: 101;
}
.alert {
  background: var(--accent-color);
  border-radius: 10px;
  padding: 10px;
  position: relative;
  width: 100%;
  margin-bottom: 5px;
  animation: fadeIn var(--speed-normal) forwards;
  box-shadow: 0 15px 20px 0 var(--shadow-color);
}
.error {
  background: var(--red);
}
.success {
  background: var(--green);
}
.warning {
  background: var(--yellow);
}
.alert i {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 20px;
}
.alert h4 {
  font-size: 20px;
  margin-bottom: 5px;
}
.alert pre {
  font-size: 16px;
  white-space: pre-wrap;
}
.alert .bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.alert .bottom button {
  background: rgba(255, 255, 255, 0.5);
  border-radius: 10px;
  padding: 8px;
  border: 0;
  cursor: pointer;
  font-size: 16px;
  margin-left: 15px;
}

@keyframes fadeIn {
  0% {
    margin-bottom: -80px;
  }
  100% {
    margin-bottom: 5;
  }
}

@media screen and (max-width: 600px) {
  .alert-wrapper {
    width: 100%;
    max-width: none;
    min-width: 0;
  }
}
</style>