window.Drag = class Drag {
  constructor({
    range,
    onStart,
    setter,
    onEnd,
    onDone,
    animationLength = 250,
    bezierPoints = [0, 0.85, 0.95, 1],
    direction = 'x',
    surface = window,
    target = null,
    multiplier = 1,
    startOnCreated = true,
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }) {
    this.range = range
    this.onStart = onStart
    this.setter = setter
    this.onEnd = onEnd
    this.onDone = onDone
    this.target = target
    this.surface = surface
    this.direction = direction
    this.multiplier = multiplier
    this.bezierPoints = bezierPoints
    this.animationLength = animationLength
    this.stopped = !startOnCreated
    this.isMobile = isMobile

    this.range.start = this.range.start || this.range.from
    this.state = this.range.start
    this.moving = false
    this.frame = null

    this.eventPreProcessors = {
      x: {
        mousedownHandler: ({target, screenX}) => this.startHandler(target, screenX),
        mousemoveHandler: ({screenX}) => this.moveHandler(screenX),
        touchstartHandler: ({target, changedTouches: [{screenX}]}) => this.startHandler(target, screenX),
        touchmoveHandler: ({changedTouches: [{screenX}]}) => this.moveHandler(screenX),
      },
      y: {
        mousedownHandler: ({target, screenY}) => this.startHandler(target, screenY),
        mousemoveHandler: ({screenY}) => this.moveHandler(screenY),
        touchstartHandler: ({target, changedTouches: [{screenY}]}) => this.startHandler(target, screenY),
        touchmoveHandler: ({changedTouches: [{screenY}]}) => this.moveHandler(screenY),
      }
    }
    this.bindedEndHandler = this.endHandler.bind(this)
    this.bindedEndAnimate = this.endAnimate.bind(this)

    if(startOnCreated) this.start()
  }
  start() {
    if(this.isMobile) {
      this.surface.addEventListener('touchstart', this.eventPreProcessors[this.direction].touchstartHandler)
      this.surface.addEventListener('touchmove', this.eventPreProcessors[this.direction].touchmoveHandler)
      this.surface.addEventListener('touchend', this.bindedEndHandler)
    } else {
      this.surface.addEventListener('mousedown', this.eventPreProcessors[this.direction].mousedownHandler)
      this.surface.addEventListener('mouseup', this.bindedEndHandler)
    }

    this.stopped = false
  }
  stop() {
    if(this.isMobile) {
      this.surface.removeEventListener('touchstart', this.eventPreProcessors[this.direction].touchstartHandler)
      this.surface.removeEventListener('touchmove', this.eventPreProcessors[this.direction].touchmoveHandler)
      this.surface.removeEventListener('touchend', this.bindedEndHandler)
    } else {
      this.surface.removeEventListener('mousedown', this.eventPreProcessors[this.direction].mousedownHandler)
      this.surface.removeEventListener('mousemove', this.eventPreProcessors[this.direction].mousemoveHandler)
      this.surface.removeEventListener('mouseup', this.bindedEndHandler)
    }

    this.stopped = true
  }

  startHandler(target, position) {
    if(this.moving || (this.target && !this.target.contains(target))) return

    this.startPosition = position
    this.startState = this.state

    if(!this.isMobile)
      this.surface.addEventListener('mousemove', this.eventPreProcessors[this.direction].mousemoveHandler)

    if(this.onStart) this.onStart(this.startState)
  }
  moveHandler(position) {
    if(!this.startPosition) return

    this.moving = true
    
    if(!this.frame) {
      this.frame = requestAnimationFrame( () => {
        this.frame = null

        this.state = (position-this.startPosition) * this.multiplier + this.startState
        if(this.state > this.range.to) this.state = this.range.to
        else if(this.state < this.range.from) this.state = this.range.from
        
        this.setter(this.state)
      })
    }
  }
  endHandler() {
    if(!this.isMobile)
      this.surface.removeEventListener('mousemove', this.eventPreProcessors[this.direction].mousemoveHandler)

    if(!this.moving) {
      if(this.onDone) this.onDone(this.state)
      return
    }

    if(this.frame) cancelAnimationFrame(this.frame)
    this.frame = null

    this.endState = this.onEnd(this.state)
    this.endAnimationStartAt = this.state
    this.endAnimationRange = this.endState-this.state
    this.endAnimationBezierPoints = this.bezierPoints.map( percent => this.endAnimationRange * percent )
    this.endAnimationStartTime = performance.now()
    this.endAnimationMinMax = this.endAnimationRange < 0 ? 'max' : 'min'
    requestAnimationFrame(this.bindedEndAnimate)
  }
  endAnimate() {
    if(this.state == this.endState) {
      if(this.onDone) this.onDone(this.state)

      this.startPosition = null
      this.state = this.endState
      this.moving = false
      return
    }

    let elapsedTime = performance.now() - this.endAnimationStartTime
    let animationPercent = elapsedTime / this.animationLength

    // below we calculate the range status using bezier "curves" (only on one axe)
    // this can be used for animation timings
    let bezierPoints = [...this.endAnimationBezierPoints]

    for(let i=0; i<bezierPoints.length-1; ++i) {
      for(let j=0; j<bezierPoints.length-1-i; ++j) {
        let currRange = bezierPoints[j+1] - bezierPoints[j]
        let rangeDone = animationPercent * currRange
  
        bezierPoints[j] += rangeDone
      }
    }

    // the last remaining point is the current status
    let rangeDone = bezierPoints[0]

    this.state = Math[this.endAnimationMinMax](this.endAnimationStartAt + rangeDone, this.endState)
    this.setter(this.state)

    requestAnimationFrame(this.bindedEndAnimate)
  }
}