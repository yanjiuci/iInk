// ImageEditor - lightweight image editing utility using Canvas
// Supports: adjustImage, applyFilter, cropImage, addText, saveToLocal, exportImage

export default class ImageEditor {
  constructor({width = 800, height = 600} = {}){
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')
    this.canvas.width = width
    this.canvas.height = height

    // store original source image for re-rendering
    this._sourceImage = null

    // filter state (numeric values or booleans)
    this.filters = {
      brightness: 1, // 1 is normal
      contrast: 1,   // 1 is normal
      saturate: 1,
      blur: 0,       // px
      hue: 0,        // deg
      grayscale: 0,  // 0..1
      sepia: 0,      // 0..1
      invert: 0      // 0..1
    }

    // user-added text layers
    this.textLayers = []
    // selected text index for editing
    this._selectedTextIndex = -1
    this.onSelectionChange = null // callback(index, layer)

    // composed CSS filter string cache
    this._filterString = ''
    
    // undo/redo history
    this._history = []
    this._historyIndex = -1
    this._historyLimit = 50
    // dragging state
    this._drag = null

    // wire canvas pointer events for selecting and dragging text
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
    this._filterString = parts.join(' ')
    return this._filterString
  }

  // internal render: draw sourceImage with filters and then text layers
  _render(){
    const ctx = this.ctx
    if(!this._sourceImage) {
      ctx.clearRect(0,0,this.canvas.width,this.canvas.height)
      return
    }

    // draw image with CSS filters (canvas filter property)
    this._composeFilter()
    ctx.save()
    ctx.filter = this._filterString || 'none'
    ctx.clearRect(0,0,this.canvas.width,this.canvas.height)
    ctx.drawImage(this._sourceImage, 0, 0, this.canvas.width, this.canvas.height)
    ctx.restore()

    // draw texts (without filters)
    this.textLayers.forEach(t=>{
      ctx.save()
      ctx.filter = 'none'
      ctx.font = `${t.fontWeight ? t.fontWeight + ' ' : ''}${t.fontSize || 24}px ${t.font || 'sans-serif'}`
      // indicate selection with a rectangle
      const idx = this.textLayers.indexOf(t)
      if(typeof this._selectedTextIndex !== 'undefined' && idx === this._selectedTextIndex){
        try{
          const metrics = ctx.measureText(t.text)
          const w = metrics.width
          const h = t.fontSize || 24
          let x0 = t.x
          if((t.align || 'left') === 'center') x0 = t.x - w/2
          if((t.align || 'left') === 'right') x0 = t.x - w
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'
          ctx.lineWidth = 2
          ctx.strokeRect(x0-4, t.y-4, w+8, h+8)
        }catch(e){}
      }
      ctx.textAlign = t.align || 'left'
      ctx.textBaseline = t.baseline || 'top'
      if(t.shadow){
        ctx.shadowColor = t.shadow.color || 'rgba(0,0,0,0.3)'
        ctx.shadowBlur = t.shadow.blur || 6
        ctx.shadowOffsetX = t.shadow.offsetX || 0
        ctx.shadowOffsetY = t.shadow.offsetY || 2
      }
      ctx.fillStyle = t.color || '#fff'
      if(t.stroke){
        ctx.lineWidth = t.stroke.width || 2
        ctx.strokeStyle = t.stroke.color || '#000'
        ctx.strokeText(t.text, t.x, t.y)
      }
      ctx.fillText(t.text, t.x, t.y)
      ctx.restore()
    })
  }

  // 1. adjustImage(filter, value)
  // filter: 'brightness'|'contrast'|'saturate'|'blur'|'hue'|'grayscale'|'sepia'|'invert'
  // value: number (meaning depends on filter)
  adjustImage(filter, value){
    if(!(filter in this.filters)){
      throw new Error('Unknown filter: ' + filter)
    }
    try{ this._saveState() }catch(e){}
    this.filters[filter] = value
    this._render()
    return this
  }

  // 2. applyFilter(filterName) - predefined filter presets
  applyFilter(filterName){
    const presets = {
      none: {brightness:1,contrast:1,saturate:1,grayscale:0,sepia:0,invert:0,blur:0,hue:0},
      grayscale: {grayscale:1},
      vintage: {sepia:0.5, contrast:1.1, saturate:0.9},
      vivid: {saturate:1.6, contrast:1.05, brightness:1.02},
      noir: {grayscale:1, contrast:1.2, brightness:0.95},
      invert: {invert:1}
    }
    const preset = presets[filterName]
    if(!preset) throw new Error('Unknown preset: ' + filterName)
    try{ this._saveState() }catch(e){}
    // merge with defaults
    Object.keys(this.filters).forEach(k=>{
      if(k in preset) this.filters[k] = preset[k]
    })
    this._render()
    return this
  }

  // 3. cropImage(x, y, width, height)
  cropImage(x, y, width, height){
    try{ this._saveState() }catch(e){}
    // create temporary canvas and draw current canvas content onto it
    const tmp = document.createElement('canvas')
    tmp.width = width
    tmp.height = height
    const tctx = tmp.getContext('2d')
    tctx.drawImage(this.canvas, x, y, width, height, 0, 0, width, height)

    // replace sourceImage with new image created from tmp
    const dataUrl = tmp.toDataURL('image/png')
    const img = new Image()
    img.src = dataUrl
    this._sourceImage = img
    this.canvas.width = width
    this.canvas.height = height
    // clear text layers (they're in the old canvas); keep if desired - here we clear
    this.textLayers = []
    // once image loads, render
    img.onload = ()=> this._render()
    return this
  }

  // 4. addText(text, options)
  // options: { x, y, fontSize, font, color, align, baseline, stroke, shadow }
  addText(text, options = {}){
    try{ this._saveState() }catch(e){}
    const layer = Object.assign({
      text,
      x: options.x || 10,
      y: options.y || 10,
      fontSize: options.fontSize || 28,
      font: options.font || 'sans-serif',
      color: options.color || '#fff',
      align: options.align || 'left',
      baseline: options.baseline || 'top',
      stroke: options.stroke || null,
      shadow: options.shadow || null
    }, options)
    this.textLayers.push(layer)
    // select newly added text
    this._selectedTextIndex = this.textLayers.length - 1
    try{ if(this.onSelectionChange) this.onSelectionChange(this._selectedTextIndex, this.textLayers[this._selectedTextIndex]) }catch(e){}
    this._render()
    return this
  }

  // Select text at canvas coordinates (returns index or -1)
  selectTextAt(x, y){
    for(let i = this.textLayers.length - 1; i >= 0; i--){
      const t = this.textLayers[i]
      this.ctx.save()
      this.ctx.font = `${t.fontWeight ? t.fontWeight + ' ' : ''}${t.fontSize || 24}px ${t.font || 'sans-serif'}`
      const metrics = this.ctx.measureText(t.text)
      const w = metrics.width
      const h = t.fontSize || 24
      let x0 = t.x
      if((t.align || 'left') === 'center') x0 = t.x - w/2
      if((t.align || 'left') === 'right') x0 = t.x - w
      const y0 = t.y
      this.ctx.restore()
      if(x >= x0 - 4 && x <= x0 + w + 4 && y >= y0 - 4 && y <= y0 + h + 4){
        this._selectedTextIndex = i
        try{ if(this.onSelectionChange) this.onSelectionChange(i, this.textLayers[i]) }catch(e){}
        return i
      }
    }
    // none selected
    this._selectedTextIndex = -1
    try{ if(this.onSelectionChange) this.onSelectionChange(-1, null) }catch(e){}
    return -1
  }

  // Update text layer properties
  updateText(index, props = {}){
    if(index < 0 || index >= this.textLayers.length) return false
    Object.assign(this.textLayers[index], props)
    this._render()
    try{ this._saveState() }catch(e){}
    return true
  }

  deleteText(index){
    if(index < 0 || index >= this.textLayers.length) return false
    this.textLayers.splice(index,1)
    this._selectedTextIndex = -1
    try{ if(this.onSelectionChange) this.onSelectionChange(-1, null) }catch(e){}
    this._render()
    try{ this._saveState() }catch(e){}
    return true
  }

  // 5. saveToLocal(filename)
  // triggers a download of the current canvas content
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

  // 6. exportImage(type, quality) - returns a Blob
  exportImage(type = 'image/png', quality = 0.92){
    return new Promise((res, rej)=>{
      this.canvas.toBlob(blob=>{
        if(!blob) return rej(new Error('Export failed'))
        res(blob)
      }, type, quality)
    })
  }

  // helper: get dataURL
  toDataURL(type = 'image/png', quality = 0.92){
    return this.canvas.toDataURL(type, quality)
  }

  // History helpers: capture, save, restore, undo, redo
  _captureState(){
    const state = {
      filters: JSON.parse(JSON.stringify(this.filters)),
      textLayers: JSON.parse(JSON.stringify(this.textLayers)),
      imageDataUrl: null
    }
    try{
      state.imageDataUrl = this.canvas.toDataURL('image/png')
    }catch(e){
      state.imageDataUrl = null
    }
    return state
  }

  // Pointer event handlers for selecting and dragging text
  _onPointerDown(ev){
    const rect = this.canvas.getBoundingClientRect()
    const x = ev.clientX - rect.left
    const y = ev.clientY - rect.top
    const idx = this.selectTextAt(x, y)
    if(idx >= 0){
      // start drag
      try{ this._saveState() }catch(e){}
      this._drag = { index: idx, startX: x, startY: y, origX: this.textLayers[idx].x, origY: this.textLayers[idx].y }
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
    if(idx >=0 && this.textLayers[idx]){
      this.textLayers[idx].x = this._drag.origX + dX
      this.textLayers[idx].y = this._drag.origY + dY
      this._render()
    }
  }

  _onPointerUp(ev){
    if(!this._drag) return
    // finalize and clear drag
    this._drag = null
    try{ this._saveState() }catch(e){}
  }

  _saveState(){
    const s = this._captureState()
    // if we are not at the end, drop forward history
    if(this._historyIndex < this._history.length - 1){
      this._history = this._history.slice(0, this._historyIndex + 1)
    }
    this._history.push(s)
    // enforce limit
    if(this._history.length > this._historyLimit){
      this._history.shift()
    } else {
      this._historyIndex++
    }
  }

  _restoreState(state){
    if(!state) return
    this.filters = JSON.parse(JSON.stringify(state.filters || this.filters))
    this.textLayers = JSON.parse(JSON.stringify(state.textLayers || []))
    if(state.imageDataUrl){
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = ()=>{
        this._sourceImage = img
        // resize canvas to image
        this.canvas.width = img.naturalWidth || img.width || this.canvas.width
        this.canvas.height = img.naturalHeight || img.height || this.canvas.height
        this._render()
      }
      img.src = state.imageDataUrl
    } else {
      this._render()
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

  // expose DOM element for insertion
  getElement(){
    return this.canvas
  }
}

/*
Usage example:

import ImageEditor from './image-editor.js'

const editor = new ImageEditor()
await editor.load('https://picsum.photos/800/600')
document.body.appendChild(editor.getElement())

editor.adjustImage('brightness', 1.1)
editor.adjustImage('contrast', 1.2)
editor.applyFilter('vivid')
editor.addText('示例文字', { x: 24, y: 520, fontSize: 30, color: '#fff', stroke: { width: 3, color: 'rgba(0,0,0,0.6)' } })
// crop to center square
editor.cropImage(100, 50, 600, 600)
// save
await editor.saveToLocal('edited.png')
*/