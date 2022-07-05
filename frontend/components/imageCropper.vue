<template>
  <div class="canvas-wrapper" ref="wrapper">
    <canvas ref="img"/>
    <canvas ref="ui"/>
  </div>
</template>

<script>
export default {
  props: {
    img: {
      type: File,
      required: true,
    },
    ratio: {
      type: Number,
      default: null
    },
    minWidth: {
      tpye: Number,
      default: 50,
    },
    minHeight: {
      tpye: Number,
      default: 50,
    },
    ellipsisMask: {
      type: Boolean,
      default: false
    },
    lineColor: {
      type: String,
      default: '#FF4C58'
    },
    lineWidth: {
      type: Number,
      default: 4,
      validator: value => value % 2 == 0 // should be an even number
    },
    maskColor: {
      type: String,
      default: 'rgba(0, 0, 0, 0.8)'
    },
    treshold: {
      type: Number,
      default: 12,
    },
  },
  data() {
    return {
      src: null,
      imgCtx: null,
      uiCtx: null,
      isMouseDown: false,
      rect: {
        x: 0,
        y: 0,
        width: 0,
        heigth: 0,
      },
      draggedSides: [],
      prevX: 0,
      prevY: 0,
      opposites: {
        left: 'right',
        right: 'left',
        top: 'bottom',
        bottom: 'top'
      },
      aspectRatio: this.$props.ratio,
      correctedMinWidth: 0,
      correctedMinHeight: 0,
    }
  },
  mounted() {
    this.imgCtx = this.$refs.img.getContext('2d')
    this.uiCtx = this.$refs.ui.getContext('2d')

    this.image = new Image()
    this.image.onload = () => {
      this.init()
      this.setHandlers()
    }

    this.image.src = URL.createObjectURL(this.$props.img)
  },
  methods: {
    getImage() {
      let tempCanvas = document.createElement('canvas')
      let tempCtx = tempCanvas.getContext('2d')

      // draws the original image on the canvas in full size
      tempCanvas.width = this.image.width
      tempCanvas.height = this.image.height
      tempCtx.drawImage(this.image, 0, 0, this.image.width, this.image.height, 0, 0, this.image.width, this.image.height)

      // calculates the corrected positions of the rect and reads the image part
      let sizeDiff = this.image.height / this.$refs.img.height
      let correctedInsideX = (this.rect.x + this.lineWidth) * sizeDiff
      let correctedInsideY = (this.rect.y + this.lineWidth) * sizeDiff
      let correctedInsideWidth = (this.rect.width - this.lineWidth*2) * sizeDiff
      let correctedInsideHeight = (this.rect.height - this.lineWidth*2) * sizeDiff

      let data = tempCtx.getImageData(correctedInsideX, correctedInsideY, correctedInsideWidth, correctedInsideHeight)

      // draws only the cropped part on the full canvas
      tempCanvas.width = correctedInsideWidth
      tempCanvas.height = correctedInsideHeight
      tempCtx.putImageData(data, 0, 0)
      
      // Reads the content of the canvas as Blob, creates a File from it and returnes it (in a Promise)
      return new Promise(resolve => {
        let callback = blob => {
          let file = new File([blob], this.$props.img.name)
          resolve(file)
        }

        tempCanvas.toBlob(callback, this.$props.img.type)
      })
    },
    init() {
      let imgRatio = this.image.width / this.image.height

      if(this.$props.ratio === 0)
        this.aspectRatio = imgRatio

      this.calcCanvasSize(imgRatio)
      this.calcRectSize()

      let sizeDiff = this.$refs.img.height / this.image.height
      this.correctedMinWidth = sizeDiff * this.$props.minWidth
      this.correctedMinHeight = sizeDiff * this.$props.minHeight

      this.imgCtx.drawImage(this.image, 0, 0, this.image.width, this.image.height, 0, 0, this.$refs.img.width, this.$refs.img.height)
      this.drawUI()
    },
    calcCanvasSize(imgRatio) {
      let [width, height] = this.calcSizeFromRatio(
        this.$refs.wrapper.clientWidth,
        this.$refs.wrapper.clientHeight,
        imgRatio
      )

      this.$refs.img.width = width
      this.$refs.img.height = height

      this.$refs.ui.width = width
      this.$refs.ui.height = height
    },
    calcRectSize() {
      let width, height

      if(!this.aspectRatio) {
        width = this.$refs.img.width
        height = this.$refs.img.height
      }
      else {
        [width, height] = this.calcSizeFromRatio(
          this.$refs.img.width,
          this.$refs.img.height,
          this.aspectRatio
        )
      }

      this.rect.width = width
      this.rect.height = height
      this.rect.x = (this.$refs.img.width - width) / 2
      this.rect.y = (this.$refs.img.height - height) / 2
    },
    calcSizeFromRatio(maxWidth, maxHeight, ratio) {
      let width = maxWidth
      let height = maxWidth / ratio

      if(height > maxHeight) {
        height = maxHeight
        width = maxHeight * ratio
      }

      return [width, height]
    },
    setHandlers() {
      // sets gesture start events
      let handleStart = (clientX, clientY) => {
        let [x, y] = this.calcOffsetCoords(clientX, clientY)
        this.prevX = x
        this.prevY = y

        if(!this.isInsideRect(x, y)) return
        
        this.draggedSides = this.getDraggedSides(x, y)
        this.isMouseDown = true
      }

      this.$refs.ui.addEventListener('mousedown', ({clientX, clientY}) => handleStart(clientX, clientY))
      this.$refs.ui.addEventListener('touchstart', ({changedTouches: [{clientX, clientY}]}) => handleStart(clientX, clientY))

      // sets gesture end events
      let handleEnd = () => {
        this.draggedSides = []
        this.isMouseDown = false
      }

      this.$refs.ui.addEventListener('mouseup', handleEnd)
      this.$refs.ui.addEventListener('mouseleave', handleEnd)
      this.$refs.ui.addEventListener('touchend', handleEnd)

      // sets gesture movement events
      this.$refs.wrapper.addEventListener('mousemove', event => event.preventDefault() )
      this.$refs.wrapper.addEventListener('touchmove', event => event.preventDefault() )
      
      let handleMovement = (clientX, clientY) => {
        let [x, y] = this.calcOffsetCoords(clientX, clientY)
        this.handleMouseMovement(x, y)
      }

      this.$refs.ui.addEventListener('mousemove', ({clientX, clientY}) => handleMovement(clientX, clientY))
      this.$refs.ui.addEventListener('touchmove', ({changedTouches: [{clientX, clientY}]}) => handleMovement(clientX, clientY))

      // set wrapper resize handlers
      let observer = new ResizeObserver(() => this.init())
      observer.observe(this.$refs.wrapper)
    },
    calcOffsetCoords(x, y) {
      let canvasOffsets = this.$refs.ui.getBoundingClientRect() 

      return [
        x - canvasOffsets.left,
        y - canvasOffsets.top
      ]
    },
    getDraggedSides(x, y) {
      let sides = []

      if(this.isInProximity(x, this.rect.x + this.lineWidth/2))
        sides.push('left')
      else if(this.isInProximity(x, this.rect.x + this.rect.width - this.lineWidth/2))
        sides.push('right')

      if(this.isInProximity(y, this.rect.y + this.lineWidth/2))
        sides.push('top')
      else if(this.isInProximity(y, this.rect.y + this.rect.height - this.lineWidth/2))
        sides.push('bottom')

      return sides
    },
    isInsideRect(x, y) {
      return  (x > this.rect.x - this.$props.treshold) &&
              (x < this.rect.x + this.rect.width + this.$props.treshold) &&
              (y > this.rect.y - this.$props.treshold) &&
              (y < this.rect.y + this.rect.height + this.$props.treshold)
    },
    drawUI() {
      // clear the previus frame
      this.uiCtx.clearRect(0, 0, this.$refs.ui.width, this.$refs.ui.height)

      // drawing the mask color on the whole canvas
      this.uiCtx.fillStyle = this.$props.maskColor
      this.uiCtx.fillRect(0, 0, this.$refs.ui.width, this.$refs.ui.height)

      // if ellipsis-mask is on, we clip the canvas to the ellipsis
      if(this.$props.ellipsisMask) {
        this.uiCtx.save()

        let xCenter = this.rect.x + this.rect.width/2
        let yCenter = this.rect.y + this.rect.height/2
        let xRadius = this.rect.width/2 - this.lineWidth
        let yRadius = this.rect.height/2 - this.lineWidth

        this.uiCtx.beginPath()
        this.uiCtx.ellipse(xCenter, yCenter, xRadius, yRadius, 0, 0, 2 * Math.PI)
        this.uiCtx.clip()
      }

      // clear the inside part of the rect from the mask color (this will only clear inside the ellipsis if clipped)
      let xPos = this.rect.x + this.lineWidth/2
      let yPos = this.rect.y + this.lineWidth/2
      let width = this.rect.width - this.lineWidth
      let height = this.rect.height - this.lineWidth

      this.uiCtx.clearRect(xPos, yPos, width, height)
      this.uiCtx.restore()

      // draw the rectangle
      this.uiCtx.lineWidth = this.$props.lineWidth
      this.uiCtx.strokeStyle = this.$props.lineColor

      this.uiCtx.beginPath()
      this.uiCtx.rect(xPos, yPos, width, height)
      this.uiCtx.stroke()
    },
    handleMouseMovement(x, y) {
      this.setMouseCursor(x, y)
      if(!this.isMouseDown) return

      let xMovement = x - this.prevX
      let yMovement = y - this.prevY

      let target = {...this.rect}

      this.handleMovement(xMovement, yMovement, target)

      if(this.aspectRatio)
        this.handleRatio(target)

      if(!this.draggedSides.length)
        this.handleFullDrag(xMovement, yMovement, target)

      let notPossible = this.handleOverflows(target, this.draggedSides.length)
      if(!notPossible) this.rect = target

      this.drawUI()

      this.prevX = x
      this.prevY = y
    },
    setMouseCursor(x, y) {
      if(this.isMouseDown) return

      if(!this.isInsideRect(x, y))
        return this.$refs.ui.style.cursor = 'default'

      let sides = this.getDraggedSides(x, y)

      if(!sides.length) {
        this.$refs.ui.style.cursor = 'move'
      }
      else if(sides.length == 2) {
        if(sides.includes('left')) {
          if(sides.includes('top'))
            this.$refs.ui.style.cursor = 'nwse-resize'
          else
            this.$refs.ui.style.cursor = 'nesw-resize'
        }
        else {
          if(sides.includes('top'))
            this.$refs.ui.style.cursor = 'nesw-resize'
          else
            this.$refs.ui.style.cursor = 'nwse-resize'
        }
      }
      else if(sides.includes('left') || sides.includes('right')) {
        this.$refs.ui.style.cursor = 'ew-resize'
      }
      else if(sides.includes('top') || sides.includes('bottom')) {
        this.$refs.ui.style.cursor = 'ns-resize'
      }
    },
    handleMovement(xMovement, yMovement, target) {
      if(this.draggedSides.includes('left')) {
        target.x += xMovement
        target.width -= xMovement
      }
      else if(this.draggedSides.includes('right')) {
        target.width += xMovement
      }
      
      if(this.draggedSides.includes('top')) {
        target.y += yMovement
        target.height -= yMovement
      }
      else if(this.draggedSides.includes('bottom')) {
        target.height += yMovement
      }
    },
    handleRatio(target) {
      if(this.draggedSides.length == 1) {
        if(this.draggedSides.includes('left') || this.draggedSides.includes('right')) {
          let height = target.width / this.aspectRatio

          let verticalCenter = target.y + target.height/2

          target.y = verticalCenter - height/2
          target.height = height
        }
        else if(this.draggedSides.includes('top') || this.draggedSides.includes('bottom')) {
          let width = target.height * this.aspectRatio

          let horizontalCenter = target.x + target.width/2

          target.x = horizontalCenter - width/2
          target.width = width
        }
      }
      else {
        let area = target.width * target.height

        let newHeight = Math.sqrt(area / this.aspectRatio)
        let newWidth = newHeight * this.aspectRatio

        target.width = newWidth
        target.height = newHeight

        if(this.draggedSides.includes('left'))  
          target.x = this.rect.x + this.rect.width - newWidth

        if(this.draggedSides.includes('top'))  
          target.y = this.rect.y + this.rect.height - newHeight
      }
    },
    handleFullDrag(xMovement, yMovement, target) {
      target.x += xMovement
      target.y += yMovement
    },
    handleOverflows(target, checkSize = false) {
      if(target.x <= 0) target.x = 0
      if(target.y <= 0) target.y = 0

      if(target.x + target.width > this.$refs.img.clientWidth)
        target.x = this.$refs.img.clientWidth - target.width

      if(target.y + target.height > this.$refs.img.clientHeight)
        target.y = this.$refs.img.clientHeight - target.height

      if(!checkSize) return false

      return  target.width > this.$refs.img.clientWidth ||
              target.height > this.$refs.img.clientHeight ||
              target.width < this.correctedMinWidth + this.lineWidth*2 ||
              target.height < this.correctedMinHeight + this.lineWidth*2
    },
    isInProximity(pos1, pos2) {
      let dist = pos2 - pos1

      return Math.abs(dist) < this.$props.treshold + this.lineWidth/2
    }
  },
}
</script>

<style scoped lang="css">
  .canvas-wrapper {
    position: relative;
    height: 100%;
    width: 100%;   
  }

  .canvas-wrapper canvas {
    position: absolute;
    toP: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
</style>