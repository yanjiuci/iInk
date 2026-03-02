// ImageEditor - Professional image editing utility using Canvas
// Supports: adjustImage, applyFilter, cropImage, rotate, flip, addText, addSticker, saveToLocal, exportImage

export default class ImageEditor {
  constructor({width = 800, height = 600} = {}){
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')
    this.canvas.width = width
    this.canvas.height = height

    // store original source image for re-rendering
    this._sourceImage = null
    this._originalImage = null // Keep original for reset

    // Canvas transform state
    this.canvasState = {
      rotation: 0, // degrees
      flipH: false,
      flipV: false,
      scale: 1
    }

    // filter state (numeric values or booleans)
    this.filters = {
      brightness: 1,
      contrast: 1,
      saturate: 1,
      blur: 0,
      hue: 0,
      grayscale: 0,
      sepia: 0,
      invert: 0,
      opacity: 1,
      warmth: 0, // -1 to 1
      tint: 0, // -1 to 1
      vibrance: 0, // -1 to 1
      highlights: 0, // -1 to 1
      shadows: 0, // -1 to 1
      vignette: 0 // 0 to 1
    }

    // user-added layers (text and stickers)
    this.layers = []
    this._selectedLayerIndex = -1
    this.onSelectionChange = null

    // composed CSS filter string cache
    this._filterString = ''
    
    // undo/redo history
    this._history = []
    this._historyIndex = -1
    this._historyLimit = 50
    
    // dragging state
    this._drag = null
    // resizing state
    this._resize = null
    // rotating state
    this._rotate = null

    // wire canvas pointer events
    this.canvas.addEventListener('mousedown', this._onPointerDown.bind(this))
    window.addEventListener('mousemove', this._onPointerMove.bind(this))
    window.addEventListener('mouseup', this._onPointerUp.bind(this))
  }

  // Load image from a URL or HTMLImageElement
  async load(src){
    if(typeof src === 'string'){
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise((res, rej)=>{ img.onload = res; img.onerror = rej; img.src = src })
      return this.setImage(img)
    }
    if(src instanceof HTMLImageElement){
      return this.setImage(src)
    }
    throw new Error('Unsupported source; provide URL or HTMLImageElement')
  }

  // Set image directly
  setImage(img){
    this._sourceImage = img
    this._originalImage = img
    // resize canvas to image size
    this.canvas.width = img.naturalWidth || img.width || this.canvas.width
    this.canvas.height = img.naturalHeight || img.height || this.canvas.height
    this._render()
    try{ this._saveState() }catch(e){}
    return this
  }

  // Compose CSS filter string from `this.filters`
  _composeFilter(){
    const f = this.filters
    const parts = []
    parts.push(`brightness(${f.brightness})`)
    parts.push(`contrast(${f.contrast})`)
    parts.push(`saturate(${f.saturate})`)
    if(f.blur && f.blur > 0) parts.push(`blur(${f.blur}px)`)
    if(f.hue) parts.push(`hue-rotate(${f.hue}deg)`)
    if(f.grayscale) parts.push(`grayscale(${f.grayscale})`)
    if(f.sepia) parts.push(`sepia(${f.sepia})`)
    if(f.invert) parts.push(`invert(${f.invert})`)
    if(f.opacity !== 1) parts.push(`opacity(${f.opacity})`)
    this._filterString = parts.join(' ')
    return this._filterString
  }

  // internal render: draw sourceImage with filters and then layers
  _render(){
    const ctx = this.ctx
    if(!this._sourceImage) {
      ctx.clearRect(0,0,this.canvas.width,this.canvas.height)
      return
    }

    ctx.clearRect(0,0,this.canvas.width,this.canvas.height)

    // Save context for canvas transforms
    ctx.save()

    // Apply canvas transforms (rotation, flip)
    const cx = this.canvas.width / 2
    const cy = this.canvas.height / 2
    ctx.translate(cx, cy)
    ctx.rotate(this.canvasState.rotation * Math.PI / 180)
    ctx.scale(this.canvasState.flipH ? -1 : 1, this.canvasState.flipV ? -1 : 1)
    ctx.translate(-cx, -cy)

    // draw image with CSS filters
    this._composeFilter()
    ctx.filter = this._filterString || 'none'
    ctx.drawImage(this._sourceImage, 0, 0, this.canvas.width, this.canvas.height)
    ctx.restore()

    // Apply vignette effect if needed
    if(this.filters.vignette > 0) {
      this._applyVignette()
    }

    // draw layers (text and stickers) without filters
    this.layers.forEach((layer, idx)=>{
      ctx.save()
      ctx.filter = 'none'
      
      if(layer.type === 'text') {
        this._renderTextLayer(ctx, layer, idx)
      } else if(layer.type === 'sticker') {
        this._renderStickerLayer(ctx, layer, idx)
      }
      
      ctx.restore()
    })
  }

  _renderTextLayer(ctx, layer, idx){
    const isSelected = idx === this._selectedLayerIndex
    
    // Apply layer transforms
    ctx.save()
    ctx.translate(layer.x, layer.y)
    ctx.rotate((layer.rotation || 0) * Math.PI / 180)
    ctx.scale(layer.scaleX || 1, layer.scaleY || 1)
    ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1
    
    // Set font
    const fontStyle = layer.italic ? 'italic ' : ''
    const fontWeight = layer.bold ? 'bold ' : (layer.fontWeight || '')
    ctx.font = `${fontStyle}${fontWeight}${layer.fontSize || 24}px ${layer.font || 'sans-serif'}`
    
    // Calculate text dimensions
    const metrics = ctx.measureText(layer.text)
    const w = metrics.width
    const h = layer.fontSize || 24
    
    // Handle text alignment
    let xOffset = 0
    if((layer.align || 'left') === 'center') xOffset = -w/2
    if((layer.align || 'left') === 'right') xOffset = -w
    
    // Draw selection box
    if(isSelected){
      ctx.strokeStyle = '#0b74ff'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.strokeRect(xOffset - 6, -6, w + 12, h + 12)
      ctx.setLineDash([])
      
      // Draw resize handles
      this._drawResizeHandles(ctx, xOffset - 6, -6, w + 12, h + 12)
    }
    
    // Draw shadow
    if(layer.shadow && layer.shadow.enabled !== false){
      ctx.shadowColor = layer.shadow.color || 'rgba(0,0,0,0.3)'
      ctx.shadowBlur = layer.shadow.blur || 6
      ctx.shadowOffsetX = layer.shadow.offsetX || 0
      ctx.shadowOffsetY = layer.shadow.offsetY || 2
    }
    
    // Draw stroke
    if(layer.stroke && layer.stroke.enabled !== false){
      ctx.lineWidth = layer.stroke.width || 2
      ctx.strokeStyle = layer.stroke.color || '#000'
      ctx.strokeText(layer.text, xOffset, 0)
    }
    
    // Draw fill
    ctx.fillStyle = layer.color || '#fff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(layer.text, xOffset, 0)
    
    ctx.restore()
  }

  _renderStickerLayer(ctx, layer, idx){
    const isSelected = idx === this._selectedLayerIndex
    
    ctx.save()
    ctx.translate(layer.x, layer.y)
    ctx.rotate((layer.rotation || 0) * Math.PI / 180)
    ctx.scale(layer.scaleX || 1, layer.scaleY || 1)
    ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1
    
    if(layer.img) {
      const w = layer.width || 100
      const h = layer.height || 100
      
      // Draw selection box
      if(isSelected){
        ctx.strokeStyle = '#0b74ff'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(-w/2 - 6, -h/2 - 6, w + 12, h + 12)
        ctx.setLineDash([])
        
        // Draw resize handles
        this._drawResizeHandles(ctx, -w/2 - 6, -h/2 - 6, w + 12, h + 12)
      }
      
      ctx.drawImage(layer.img, -w/2, -h/2, w, h)
    }
    
    ctx.restore()
  }

  _drawResizeHandles(ctx, x, y, w, h){
    const handleSize = 8
    ctx.fillStyle = '#0b74ff'
    
    // Four corners
    ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize)
    ctx.fillRect(x + w - handleSize/2, y - handleSize/2, handleSize, handleSize)
    ctx.fillRect(x - handleSize/2, y + h - handleSize/2, handleSize, handleSize)
    ctx.fillRect(x + w - handleSize/2, y + h - handleSize/2, handleSize, handleSize)
  }

  _applyVignette(){
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height
    const gradient = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)/3, w/2, h/2, Math.max(w,h)/1.5)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, `rgba(0,0,0,${this.filters.vignette})`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)
  }

  // ==================== Image Adjustments ====================

  adjustImage(filter, value){
    if(!(filter in this.filters)){
      throw new Error('Unknown filter: ' + filter)
    }
    try{ this._saveState() }catch(e){}
    this.filters[filter] = value
    this._render()
    return this
  }

  // ==================== Filter Presets ====================

  applyFilter(filterName){
    const presets = {
      none: {brightness:1, contrast:1, saturate:1, grayscale:0, sepia:0, invert:0, blur:0, hue:0, opacity:1, warmth:0, tint:0, vibrance:0, highlights:0, shadows:0, vignette:0},
      // 基础滤镜
      grayscale: {grayscale:1},
      sepia: {sepia:0.8},
      invert: {invert:1},
      // 人像美化
      beauty: {brightness:1.05, contrast:0.95, saturate:1.1, vibrance:0.2},
      portrait: {brightness:1.02, contrast:0.98, saturate:0.95, warmth:0.1},
      skin: {brightness:1.03, contrast:0.97, saturate:0.9, warmth:0.05},
      // 风景
      landscape: {contrast:1.1, saturate:1.2, vibrance:0.3, clarity:0.1},
      nature: {saturate:1.3, vibrance:0.4, contrast:1.05},
      sunset: {warmth:0.4, saturate:1.2, contrast:1.1},
      // 风格化
      vintage: {sepia:0.4, contrast:1.05, saturate:0.85, vignette:0.3},
      retro: {sepia:0.6, contrast:1.1, brightness:0.95, vignette:0.4},
      film: {contrast:1.15, saturate:0.9, vignette:0.2},
      // 黑白
      noir: {grayscale:1, contrast:1.3, brightness:0.9},
      bw: {grayscale:1, contrast:1.1},
      dramatic: {grayscale:1, contrast:1.5, brightness:0.85},
      // 色彩
      vivid: {saturate:1.5, contrast:1.1, vibrance:0.4},
      warm: {warmth:0.3, saturate:1.1},
      cool: {warmth:-0.3, tint:0.1},
      // 特效
      fade: {contrast:0.85, brightness:1.1, saturate:0.8},
      moody: {contrast:1.2, brightness:0.9, saturate:0.8, vignette:0.4},
      glow: {brightness:1.1, contrast:0.9, blur:2},
      // 美食
      food: {saturate:1.25, warmth:0.15, contrast:1.05},
      // 夜景
      night: {brightness:1.1, contrast:1.2, saturate:1.1},
      cyberpunk: {saturate:1.4, contrast:1.3, hue:180}
    }
    const preset = presets[filterName]
    if(!preset) throw new Error('Unknown preset: ' + filterName)
    try{ this._saveState() }catch(e){}
    Object.keys(preset).forEach(k=>{
      if(k in this.filters) this.filters[k] = preset[k]
    })
    this._render()
    return this
  }

  // ==================== Canvas Transforms ====================

  rotateCanvas(degrees){
    try{ this._saveState() }catch(e){}
    this.canvasState.rotation = (this.canvasState.rotation + degrees) % 360
    this._render()
    return this
  }

  setRotation(degrees){
    try{ this._saveState() }catch(e){}
    this.canvasState.rotation = degrees % 360
    this._render()
    return this
  }

  flipHorizontal(){
    try{ this._saveState() }catch(e){}
    this.canvasState.flipH = !this.canvasState.flipH
    this._render()
    return this
  }

  flipVertical(){
    try{ this._saveState() }catch(e){}
    this.canvasState.flipV = !this.canvasState.flipV
    this._render()
    return this
  }

  resetTransforms(){
    try{ this._saveState() }catch(e){}
    this.canvasState = { rotation: 0, flipH: false, flipV: false, scale: 1 }
    this._render()
    return this
  }

  // ==================== Crop ====================

  cropImage(x, y, width, height){
    try{ this._saveState() }catch(e){}
    const tmp = document.createElement('canvas')
    tmp.width = width
    tmp.height = height
    const tctx = tmp.getContext('2d')
    tctx.drawImage(this.canvas, x, y, width, height, 0, 0, width, height)

    const dataUrl = tmp.toDataURL('image/png')
    const img = new Image()
    img.src = dataUrl
    this._sourceImage = img
    this.canvas.width = width
    this.canvas.height = height
    img.onload = ()=> {
      this._render()
      try{ this._saveState() }catch(e){}
    }
    return this
  }

  // ==================== Text Layer ====================

  addText(text, options = {}){
    try{ this._saveState() }catch(e){}
    const layer = {
      type: 'text',
      text,
      x: options.x || this.canvas.width / 2,
      y: options.y || this.canvas.height / 2,
      fontSize: options.fontSize || 28,
      font: options.font || 'sans-serif',
      color: options.color || '#fff',
      align: options.align || 'center',
      bold: options.bold || false,
      italic: options.italic || false,
      fontWeight: options.fontWeight || '',
      rotation: options.rotation || 0,
      opacity: options.opacity !== undefined ? options.opacity : 1,
      scaleX: options.scaleX || 1,
      scaleY: options.scaleY || 1,
      stroke: options.stroke || { enabled: true, width: 2, color: 'rgba(0,0,0,0.6)' },
      shadow: options.shadow || { enabled: true, blur: 6, color: 'rgba(0,0,0,0.3)', offsetX: 0, offsetY: 2 }
    }
    this.layers.push(layer)
    this._selectedLayerIndex = this.layers.length - 1
    try{ if(this.onSelectionChange) this.onSelectionChange(this._selectedLayerIndex, this.layers[this._selectedLayerIndex]) }catch(e){}
    this._render()
    return this
  }

  // ==================== Sticker Layer ====================

  async addSticker(src, options = {}){
    try{ this._saveState() }catch(e){}
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise((res, rej)=>{ img.onload = res; img.onerror = rej; img.src = src })
    
    const layer = {
      type: 'sticker',
      img: img,
      src: src,
      x: options.x || this.canvas.width / 2,
      y: options.y || this.canvas.height / 2,
      width: options.width || 100,
      height: options.height || 100,
      rotation: options.rotation || 0,
      opacity: options.opacity !== undefined ? options.opacity : 1,
      scaleX: options.scaleX || 1,
      scaleY: options.scaleY || 1
    }
    this.layers.push(layer)
    this._selectedLayerIndex = this.layers.length - 1
    try{ if(this.onSelectionChange) this.onSelectionChange(this._selectedLayerIndex, this.layers[this._selectedLayerIndex]) }catch(e){}
    this._render()
    return this
  }

  // ==================== Layer Management ====================

  selectLayerAt(x, y){
    for(let i = this.layers.length - 1; i >= 0; i--){
      const layer = this.layers[i]
      const bounds = this._getLayerBounds(layer)
      
      if(x >= bounds.x && x <= bounds.x + bounds.w && 
         y >= bounds.y && y <= bounds.y + bounds.h){
        this._selectedLayerIndex = i
        try{ if(this.onSelectionChange) this.onSelectionChange(i, this.layers[i]) }catch(e){}
        this._render()
        return i
      }
    }
    this._selectedLayerIndex = -1
    try{ if(this.onSelectionChange) this.onSelectionChange(-1, null) }catch(e){}
    this._render()
    return -1
  }

  _getLayerBounds(layer){
    if(layer.type === 'text'){
      this.ctx.font = `${layer.bold ? 'bold ' : ''}${layer.italic ? 'italic ' : ''}${layer.fontSize || 24}px ${layer.font || 'sans-serif'}`
      const metrics = this.ctx.measureText(layer.text)
      const w = (metrics.width + 20) * (layer.scaleX || 1)
      const h = ((layer.fontSize || 24) + 20) * (layer.scaleY || 1)
      return { x: layer.x - w/2, y: layer.y - h/2, w, h }
    } else if(layer.type === 'sticker'){
      const w = (layer.width || 100) * (layer.scaleX || 1)
      const h = (layer.height || 100) * (layer.scaleY || 1)
      return { x: layer.x - w/2, y: layer.y - h/2, w, h }
    }
    return { x: layer.x, y: layer.y, w: 0, h: 0 }
  }

  updateLayer(index, props = {}){
    if(index < 0 || index >= this.layers.length) return false
    Object.assign(this.layers[index], props)
    this._render()
    try{ this._saveState() }catch(e){}
    return true
  }

  deleteLayer(index){
    if(index < 0 || index >= this.layers.length) return false
    this.layers.splice(index, 1)
    this._selectedLayerIndex = -1
    try{ if(this.onSelectionChange) this.onSelectionChange(-1, null) }catch(e){}
    this._render()
    try{ this._saveState() }catch(e){}
    return true
  }

  moveLayer(index, direction){
    if(index < 0 || index >= this.layers.length) return false
    if(direction === 'up' && index < this.layers.length - 1){
      [this.layers[index], this.layers[index + 1]] = [this.layers[index + 1], this.layers[index]]
      this._selectedLayerIndex = index + 1
    } else if(direction === 'down' && index > 0){
      [this.layers[index], this.layers[index - 1]] = [this.layers[index - 1], this.layers[index]]
      this._selectedLayerIndex = index - 1
    }
    this._render()
    try{ this._saveState() }catch(e){}
    return true
  }

  get selectedLayerIndex() { return this._selectedLayerIndex }
  get selectedLayer() { 
    return this._selectedLayerIndex >= 0 ? this.layers[this._selectedLayerIndex] : null 
  }

  // ==================== Pointer Events ====================

  _onPointerDown(ev){
    const rect = this.canvas.getBoundingClientRect()
    const x = ev.clientX - rect.left
    const y = ev.clientY - rect.top
    
    const idx = this.selectLayerAt(x, y)
    if(idx >= 0){
      try{ this._saveState() }catch(e){}
      this._drag = { 
        index: idx, 
        startX: x, 
        startY: y, 
        origX: this.layers[idx].x, 
        origY: this.layers[idx].y 
      }
    }
  }

  _onPointerMove(ev){
    if(!this._drag) return
    const rect = this.canvas.getBoundingClientRect()
    const x = ev.clientX - rect.left
    const y = ev.clientY - rect.top
    const dX = x - this._drag.startX
    const dY = y - this._drag.startY
    const idx = this._drag.index
    if(idx >=0 && this.layers[idx]){
      this.layers[idx].x = this._drag.origX + dX
      this.layers[idx].y = this._drag.origY + dY
      this._render()
    }
  }

  _onPointerUp(ev){
    if(!this._drag) return
    this._drag = null
    try{ this._saveState() }catch(e){}
  }

  // ==================== Export ====================

  saveToLocal(filename = 'image.png'){
    return new Promise((res, rej)=>{
      this.canvas.toBlob((blob)=>{
        if(!blob) return rej(new Error('Failed to export image'))
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        res(true)
      }, 'image/png')
    })
  }

  exportImage(type = 'image/png', quality = 0.92){
    return new Promise((res, rej)=>{
      this.canvas.toBlob(blob=>{
        if(!blob) return rej(new Error('Export failed'))
        res(blob)
      }, type, quality)
    })
  }

  toDataURL(type = 'image/png', quality = 0.92){
    return this.canvas.toDataURL(type, quality)
  }

  // ==================== History ====================

  _captureState(){
    return {
      filters: JSON.parse(JSON.stringify(this.filters)),
      canvasState: JSON.parse(JSON.stringify(this.canvasState)),
      layers: JSON.parse(JSON.stringify(this.layers.map(l => {
        // Don't include image data in history for stickers
        const copy = { ...l }
        if(copy.img) delete copy.img
        return copy
      }))),
      imageDataUrl: null
    }
  }

  _restoreState(state){
    if(!state) return
    this.filters = JSON.parse(JSON.stringify(state.filters || this.filters))
    this.canvasState = JSON.parse(JSON.stringify(state.canvasState || this.canvasState))
    this.layers = JSON.parse(JSON.stringify(state.layers || []))
    this._selectedLayerIndex = -1
    this._render()
  }

  _saveState(){
    const s = this._captureState()
    if(this._historyIndex < this._history.length - 1){
      this._history = this._history.slice(0, this._historyIndex + 1)
    }
    this._history.push(s)
    if(this._history.length > this._historyLimit){
      this._history.shift()
    } else {
      this._historyIndex++
    }
  }

  undo(){
    if(this._historyIndex <= 0) return false
    this._historyIndex--
    const s = this._history[this._historyIndex]
    this._restoreState(s)
    return true
  }

  redo(){
    if(this._historyIndex >= this._history.length - 1) return false
    this._historyIndex++
    const s = this._history[this._historyIndex]
    this._restoreState(s)
    return true
  }

  get canUndo(){ return this._historyIndex > 0 }
  get canRedo(){ return this._historyIndex < this._history.length - 1 }

  // ==================== Utils ====================

  getElement(){
    return this.canvas
  }

  reset(){
    this.filters = { brightness: 1, contrast: 1, saturate: 1, blur: 0, hue: 0, grayscale: 0, sepia: 0, invert: 0, opacity: 1, warmth: 0, tint: 0, vibrance: 0, highlights: 0, shadows: 0, vignette: 0 }
    this.canvasState = { rotation: 0, flipH: false, flipV: false, scale: 1 }
    this.layers = []
    this._selectedLayerIndex = -1
    if(this._originalImage) {
      this._sourceImage = this._originalImage
    }
    this._render()
    try{ this._saveState() }catch(e){}
    return this
  }
}
