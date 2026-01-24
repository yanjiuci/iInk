const demoData = (()=>{
  const cats = ['风景','城市','动物','插画','极简']
  const arr = []
  for(let i=1;i<=30;i++){
    const c = cats[i % cats.length]
    // Use picsum for demo images
    arr.push({
      id: i,
      title: `壁纸 #${i}`,
      category: c,
      url: `https://picsum.photos/seed/wallpaper-${i}/600/400`
    })
  }
  return arr
})()

const state = {
  items: demoData,
  filter: '全部'
}

import ImageEditor from './image-editor.js'
import { compressImage, LocalStorageManager } from './utils.js'

const grid = document.getElementById('grid')
const filtersEl = document.getElementById('filters')
const template = document.getElementById('tile-template')
const installBtn = document.getElementById('installBtn')
// user profile / upload elements
const userBtn = document.getElementById('userBtn')
const userModal = document.getElementById('userModal')
const userClose = document.getElementById('userClose')
const uploadInput = document.getElementById('uploadInput')
const uploadGallery = document.getElementById('uploadGallery')

// comment modal elements
const commentModal = document.getElementById('commentModal')
const commentClose = document.getElementById('commentClose')
const commentList = document.getElementById('commentList')
const commentInput = document.getElementById('commentInput')
const commentAddBtn = document.getElementById('commentAddBtn')

// Editor modal elements
const editorModal = document.getElementById('editorModal')
const editorContainer = document.getElementById('editorContainer')
const editorClose = document.getElementById('editorClose')
const presetFilter = document.getElementById('presetFilter')
const sliders = {
  brightness: document.getElementById('slider-brightness'),
  contrast: document.getElementById('slider-contrast'),
  saturate: document.getElementById('slider-saturate'),
  blur: document.getElementById('slider-blur'),
  hue: document.getElementById('slider-hue'),
  grayscale: document.getElementById('slider-grayscale'),
  sepia: document.getElementById('slider-sepia'),
  invert: document.getElementById('slider-invert')
}
const editorText = document.getElementById('editorText')
const addTextBtn = document.getElementById('addTextBtn')
const editorSaveBtn = document.getElementById('editorSaveBtn')
const editorExportBtn = document.getElementById('editorExportBtn')

let currentEditor = null
let currentItem = null

// Local persistence for user uploads
const userStore = new LocalStorageManager('user')
const USER_UPLOADS_KEY = 'uploads'
// interactions store (likes & comments)
const interactionStore = new LocalStorageManager('interaction')
const INTERACTIONS_KEY = 'interactions'
let interactions = interactionStore.get(INTERACTIONS_KEY, {}) || {}

function saveInteractions(){ interactionStore.set(INTERACTIONS_KEY, interactions) }

function getInteraction(id){ return interactions[String(id)] || { liked: false, likes: 0, comments: [] } }

function toggleLikeById(id){
  const key = String(id)
  interactions[key] = interactions[key] || { liked:false, likes:0, comments:[] }
  interactions[key].liked = !interactions[key].liked
  if(interactions[key].liked) interactions[key].likes = (interactions[key].likes||0) + 1
  else interactions[key].likes = Math.max(0, (interactions[key].likes||0) - 1)
  saveInteractions()
  return interactions[key]
}

function addCommentToId(id, text){
  const key = String(id)
  interactions[key] = interactions[key] || { liked:false, likes:0, comments:[] }
  const c = { id: `c-${Date.now()}-${Math.floor(Math.random()*1000)}`, text, date: Date.now() }
  interactions[key].comments.push(c)
  saveInteractions()
  return c
}

function deleteCommentFromId(id, commentId){
  const key = String(id)
  if(!interactions[key] || !interactions[key].comments) return false
  interactions[key].comments = interactions[key].comments.filter(c=>c.id !== commentId)
  saveInteractions()
  return true
}

let _commentTargetId = null

function openCommentModalFor(item){
  if(!commentModal) return
  _commentTargetId = String(item.id)
  renderCommentList()
  commentModal.style.display = 'block'
  commentModal.setAttribute('aria-hidden','false')
}

function closeCommentModal(){
  if(!commentModal) return
  commentModal.style.display = 'none'
  commentModal.setAttribute('aria-hidden','true')
  _commentTargetId = null
  if(commentInput) commentInput.value = ''
}

function renderCommentList(){
  if(!commentList) return
  commentList.innerHTML = ''
  if(!_commentTargetId) return
  const data = getInteraction(_commentTargetId)
  const arr = data.comments || []
  if(arr.length === 0){ commentList.textContent = '暂无评论' ; return }
  arr.slice().reverse().forEach(c=>{
    const el = document.createElement('div')
    el.style.display = 'flex'
    el.style.justifyContent = 'space-between'
    el.style.alignItems = 'flex-start'
    el.style.padding = '8px'
    el.style.borderBottom = '1px solid #eee'

    const body = document.createElement('div')
    const t = document.createElement('div')
    t.textContent = c.text
    t.style.marginBottom = '6px'
    const meta = document.createElement('div')
    meta.style.fontSize = '12px'
    meta.style.color = '#888'
    meta.textContent = new Date(c.date).toLocaleString()
    body.appendChild(t)
    body.appendChild(meta)

    const ctrl = document.createElement('div')
    const delBtn = document.createElement('button')
    delBtn.className = 'button'
    delBtn.style.fontSize = '12px'
    delBtn.textContent = '删除'
    delBtn.addEventListener('click', ()=>{
      deleteCommentFromId(_commentTargetId, c.id)
      renderCommentList()
      renderGrid()
    })
    ctrl.appendChild(delBtn)

    el.appendChild(body)
    el.appendChild(ctrl)
    commentList.appendChild(el)
  })
}

function blobToDataURL(blob){
  return new Promise((res, rej)=>{
    const fr = new FileReader()
    fr.onload = ()=>res(fr.result)
    fr.onerror = rej
    fr.readAsDataURL(blob)
  })
}

async function loadUserUploads(){
  const uploads = userStore.get(USER_UPLOADS_KEY, []) || []
  if(!uploads || !uploads.length) return
  // prepend uploads to state items so they appear first
  uploads.reverse().forEach(u=>{
    state.items.unshift({ id: u.id, title: u.title || '上传图片', category: '上传', url: u.dataUrl, uploaded: true })
  })
}

function persistUploadRecord(record){
  const arr = userStore.get(USER_UPLOADS_KEY, []) || []
  arr.push(record)
  userStore.set(USER_UPLOADS_KEY, arr)
}

function removeUploadRecord(id){
  let arr = userStore.get(USER_UPLOADS_KEY, []) || []
  arr = arr.filter(a=>a.id !== id)
  userStore.set(USER_UPLOADS_KEY, arr)
}

function renderUploadGallery(){
  if(!uploadGallery) return
  uploadGallery.innerHTML = ''
  const uploads = userStore.get(USER_UPLOADS_KEY, []) || []
  if(uploads.length === 0){
    uploadGallery.textContent = '暂无上传'
    return
  }
  uploads.slice().reverse().forEach(u=>{
    const el = document.createElement('div')
    el.style.display = 'flex'
    el.style.flexDirection = 'column'
    el.style.gap = '6px'
    const img = document.createElement('img')
    img.src = u.dataUrl
    img.style.width = '100%'
    img.style.height = '80px'
    img.style.objectFit = 'cover'
    img.alt = u.title || '上传'
    img.addEventListener('click', ()=>{
      // insert into main grid view (move to top)
      state.items.unshift({ id: u.id, title: u.title || '上传图片', category: '上传', url: u.dataUrl, uploaded: true })
      renderFilters()
      renderGrid()
    })
    const btnRow = document.createElement('div')
    btnRow.style.display = 'flex'
    btnRow.style.gap = '6px'
    const del = document.createElement('button')
    del.className = 'button'
    del.textContent = '删除'
    del.addEventListener('click', ()=>{
      // remove from storage and from state
      removeUploadRecord(u.id)
      state.items = state.items.filter(i=>i.id !== u.id)
      renderFilters()
      renderGrid()
      renderUploadGallery()
    })
    btnRow.appendChild(del)
    el.appendChild(img)
    el.appendChild(btnRow)
    uploadGallery.appendChild(el)
  })
}

function renderFilters(){
  const cats = Array.from(new Set(['全部', ...state.items.map(i=>i.category)]))
  filtersEl.innerHTML = ''
  cats.forEach(cat=>{
    const btn = document.createElement('button')
    btn.className = 'button'
    btn.textContent = cat
    if(cat === state.filter) btn.classList.add('active')
    btn.addEventListener('click', ()=>{
      state.filter = cat
      renderFilters()
      renderGrid()
    })
    filtersEl.appendChild(btn)
  })
}

function clearGrid(){
  grid.innerHTML = ''
}

// IntersectionObserver based lazy loading for additional safety (plus loading=lazy attr)
const io = new IntersectionObserver((entries)=>{
  entries.forEach(en=>{
    if(en.isIntersecting){
      const img = en.target
      const src = img.dataset.src
      if(src){
        img.src = src
        img.removeAttribute('data-src')
      }
      io.unobserve(img)
    }
  })
},{rootMargin:'120px'})

// Preview modal elements
const previewModal = document.getElementById('previewModal')
const previewImage = document.getElementById('previewImage')
const previewClose = document.getElementById('previewClose')
const previewBackdrop = previewModal && previewModal.querySelector('.preview-backdrop')

function showPreview(url, title){
  if(!previewModal || !previewImage) return
  previewImage.src = url
  previewImage.alt = title || '预览'
  previewModal.style.display = 'block'
  previewModal.setAttribute('aria-hidden','false')
}

function hidePreview(){
  if(!previewModal) return
  previewModal.style.display = 'none'
  previewModal.setAttribute('aria-hidden','true')
  if(previewImage) previewImage.src = ''
}

if(previewClose) previewClose.addEventListener('click', hidePreview)
if(previewBackdrop) previewBackdrop.addEventListener('click', hidePreview)

function renderGrid(){
  clearGrid()
  const items = state.filter === '全部' ? state.items : state.items.filter(i=>i.category===state.filter)
  if(items.length === 0){
    const el = document.createElement('div')
    el.className = 'loading'
    el.textContent = '无可显示的壁纸'
    grid.appendChild(el)
    return
  }

  items.forEach(item=>{
    const node = template.content.cloneNode(true)
    const tile = node.querySelector('.tile')
    const img = node.querySelector('.tile-img')
    node.querySelector('.title').textContent = item.title
    node.querySelector('.category').textContent = item.category
    const saveBtn = node.querySelector('.save-btn')
    saveBtn.addEventListener('click', ()=>saveImage(item))
    const editBtn = node.querySelector('.edit-btn')
    if(editBtn) editBtn.addEventListener('click', ()=>openEditor(item))

    // like/comment UI
    const likeBtn = node.querySelector('.like-btn')
    const likeCount = node.querySelector('.like-count')
    const commentCount = node.querySelector('.comment-count')
    const commentBtn = node.querySelector('.comment-btn')
    try{
      const info = getInteraction(item.id)
      if(likeCount) likeCount.textContent = info.likes || 0
      if(commentCount) commentCount.textContent = (info.comments && info.comments.length) || 0
      if(likeBtn) { if(info.liked) likeBtn.classList.add('active') }
      if(likeBtn) likeBtn.addEventListener('click', ()=>{
        const res = toggleLikeById(item.id)
        if(likeCount) likeCount.textContent = res.likes
        if(likeBtn) { if(res.liked) likeBtn.classList.add('active'); else likeBtn.classList.remove('active') }
      })
      if(commentBtn) commentBtn.addEventListener('click', ()=> openCommentModalFor(item))
    }catch(e){}

    // Use data-src + loading=lazy attribute to defer load; IntersectionObserver will set src
    img.dataset.src = item.url
    img.alt = item.title
    img.loading = 'lazy'
    img.addEventListener('error', ()=>{img.style.background = '#f2f2f2'})
    // click to preview
    img.addEventListener('click', ()=> showPreview(item.url, item.title))

    grid.appendChild(node)
    // Observe last appended image
    const appendedImg = grid.lastElementChild.querySelector('.tile-img')
    if(appendedImg) io.observe(appendedImg)
  })
}

// --- User modal handlers ---
function showUserModal(){ if(!userModal) return; userModal.style.display = 'block'; userModal.setAttribute('aria-hidden','false'); renderUploadGallery() }
function hideUserModal(){ if(!userModal) return; userModal.style.display = 'none'; userModal.setAttribute('aria-hidden','true') }

if(userBtn) userBtn.addEventListener('click', ()=> showUserModal())
if(userClose) userClose.addEventListener('click', ()=> hideUserModal())
const userBackdrop = userModal && userModal.querySelector('.user-backdrop')
if(userBackdrop) userBackdrop.addEventListener('click', ()=> hideUserModal())

if(uploadInput) uploadInput.addEventListener('change', async (ev)=>{
  const files = Array.from(ev.target.files || [])
  if(files.length === 0) return
  for(const f of files){
    try{
      // compress then convert to dataURL for storage
      const compressed = await compressImage(f, { maxWidth: 1200, quality: 0.85 })
      const dataUrl = await blobToDataURL(compressed)
      const id = `upload-${Date.now()}-${Math.floor(Math.random()*1000)}`
      // add to app state and persist
      const item = { id, title: f.name, category: '上传', url: dataUrl, uploaded: true }
      state.items.unshift(item)
      persistUploadRecord({ id, title: f.name, dataUrl, date: Date.now() })
    }catch(err){ console.error('上传处理失败', err) }
  }
  renderFilters()
  renderGrid()
  renderUploadGallery()
  // clear input
  uploadInput.value = ''
})

// comment modal wiring
if(commentClose) commentClose.addEventListener('click', ()=> closeCommentModal())
const commentBackdrop = commentModal && commentModal.querySelector('.comment-backdrop')
if(commentBackdrop) commentBackdrop.addEventListener('click', ()=> closeCommentModal())
if(commentAddBtn) commentAddBtn.addEventListener('click', ()=>{
  const txt = commentInput && commentInput.value && commentInput.value.trim()
  if(!txt || !_commentTargetId) return
  addCommentToId(_commentTargetId, txt)
  commentInput.value = ''
  renderCommentList()
})

// ----------------- Image Editor integration -----------------
editorClose && editorClose.addEventListener('click', closeEditor)
const backdrop = editorModal && editorModal.querySelector('.editor-backdrop')
if(backdrop) backdrop.addEventListener('click', closeEditor)

function showEditorModal(){
  if(!editorModal) return
  editorModal.style.display = 'block'
  editorModal.setAttribute('aria-hidden', 'false')
}

function hideEditorModal(){
  if(!editorModal) return
  editorModal.style.display = 'none'
  editorModal.setAttribute('aria-hidden', 'true')
}

async function openEditor(item){
  currentItem = item
  showEditorModal()
  // clear previous
  if(editorContainer) editorContainer.innerHTML = ''
  try{
    currentEditor = new ImageEditor()
    await currentEditor.load(item.url)
    // expose to window for debugging in DevTools Console
    try{ window.currentEditor = currentEditor }catch(e){}
    // attach canvas
    if(editorContainer) editorContainer.appendChild(currentEditor.getElement())
    // sync controls
    syncControlsFromEditor()
    // wire controls
    Object.keys(sliders).forEach(name=>{
      const el = sliders[name]
      if(!el) return
      el.oninput = ()=>{
        const val = parseFloat(el.value)
        currentEditor.adjustImage(name, val)
        try{ if(typeof updateUndoRedoState === 'function') updateUndoRedoState() }catch(e){}
      }
    })
    if(presetFilter) presetFilter.onchange = ()=>{
      try{ currentEditor.applyFilter(presetFilter.value) }catch(e){}
      syncControlsFromEditor()
      try{ if(typeof updateUndoRedoState === 'function') updateUndoRedoState() }catch(e){}
    }
    if(addTextBtn) addTextBtn.onclick = ()=>{
      const txt = editorText && editorText.value
      if(!txt) return
      const x = 20
      const y = (currentEditor.canvas && currentEditor.canvas.height) ? currentEditor.canvas.height - 60 : 20
      currentEditor.addText(txt, { x, y, fontSize: 28, color: '#fff', stroke: { width: 3, color: 'rgba(0,0,0,0.6)' } })
      try{ if(typeof updateUndoRedoState === 'function') updateUndoRedoState() }catch(e){}
    }
    if(editorSaveBtn) editorSaveBtn.onclick = ()=>{
      const fname = `${item.title.replace(/[^a-z0-9-_]/ig,'') || 'image'}-edited.png`
      currentEditor.saveToLocal(fname).catch(()=>alert('保存失败'))
    }
    if(editorExportBtn) editorExportBtn.onclick = async ()=>{
      try{
        const blob = await currentEditor.exportImage('image/png', 0.92)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${item.title}-export.png`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      }catch(e){console.error(e)}
    }
    // Add undo/redo buttons (create controls container if missing)
    let controlsEl = editorModal.querySelector('.editor-controls')
    if(!controlsEl){
      controlsEl = document.createElement('div')
      controlsEl.className = 'editor-controls'
      // Prefer inserting controls into the right-side controls column of the editor panel
      const rightCol = editorModal.querySelector('.editor-panel > div:nth-child(2) > div:nth-child(2)')
      if(rightCol) rightCol.insertBefore(controlsEl, rightCol.firstChild)
      else if(editorContainer && editorContainer.parentNode) editorContainer.parentNode.insertBefore(controlsEl, editorContainer)
      else if(editorModal) editorModal.appendChild(controlsEl)
      // basic inline styles so controls are visible
      controlsEl.style.display = 'flex'
      controlsEl.style.gap = '8px'
      controlsEl.style.marginBottom = '8px'
    }

    // avoid duplicate buttons
    let undoBtn = controlsEl.querySelector('#undoBtn')
    let redoBtn = controlsEl.querySelector('#redoBtn')
    if(!undoBtn){
      undoBtn = document.createElement('button')
      undoBtn.id = 'undoBtn'
      undoBtn.className = 'button'
      undoBtn.textContent = '撤回'
      controlsEl.appendChild(undoBtn)
    }
    if(!redoBtn){
      redoBtn = document.createElement('button')
      redoBtn.id = 'redoBtn'
      redoBtn.className = 'button'
      redoBtn.textContent = '重做'
      controlsEl.appendChild(redoBtn)
    }

    // Text editing controls
    let fontSelect = controlsEl.querySelector('#textFont')
    let boldCheckbox = controlsEl.querySelector('#textBold')
    let colorInput = controlsEl.querySelector('#textColor')
    let sizeInput = controlsEl.querySelector('#textSize')
    let deleteTextBtn = controlsEl.querySelector('#deleteTextBtn')
    if(!fontSelect){
      fontSelect = document.createElement('select')
      fontSelect.id = 'textFont';
      ['sans-serif','serif','monospace','Georgia','Arial'].forEach(f=>{
        const o = document.createElement('option')
        o.value = f
        o.textContent = f
        fontSelect.appendChild(o)
      })
      controlsEl.appendChild(fontSelect)
    }
    if(!boldCheckbox){
      boldCheckbox = document.createElement('input')
      boldCheckbox.type = 'checkbox'
      boldCheckbox.id = 'textBold'
      const lbl = document.createElement('label')
      lbl.style.display = 'inline-flex'
      lbl.style.alignItems = 'center'
      lbl.style.gap = '6px'
      lbl.appendChild(boldCheckbox)
      lbl.appendChild(document.createTextNode('加粗'))
      controlsEl.appendChild(lbl)
    }
    if(!colorInput){
      colorInput = document.createElement('input')
      colorInput.type = 'color'
      colorInput.id = 'textColor'
      colorInput.value = '#ffffff'
      controlsEl.appendChild(colorInput)
    }
    if(!sizeInput){
      sizeInput = document.createElement('input')
      sizeInput.type = 'number'
      sizeInput.id = 'textSize'
      sizeInput.min = 8
      sizeInput.max = 200
      sizeInput.value = 28
      sizeInput.style.width = '64px'
      controlsEl.appendChild(sizeInput)
    }
    if(!deleteTextBtn){
      deleteTextBtn = document.createElement('button')
      deleteTextBtn.id = 'deleteTextBtn'
      deleteTextBtn.className = 'button'
      deleteTextBtn.textContent = '删除文字'
      controlsEl.appendChild(deleteTextBtn)
    }

    // update controls when selection changes
    if(currentEditor) currentEditor.onSelectionChange = (idx, layer)=>{
      if(!layer){
        fontSelect.value = 'sans-serif'
        boldCheckbox.checked = false
        colorInput.value = '#ffffff'
        sizeInput.value = 28
        deleteTextBtn.disabled = true
      } else {
        fontSelect.value = layer.font || 'sans-serif'
        boldCheckbox.checked = (layer.fontWeight === 'bold')
        // normalize color hex
        try{ colorInput.value = layer.color || '#ffffff' }catch(e){}
        sizeInput.value = layer.fontSize || 28
        deleteTextBtn.disabled = false
      }
    }

    // wire text control events
    fontSelect.onchange = ()=>{
      const idx = currentEditor && currentEditor._selectedTextIndex
      if(currentEditor && idx >= 0) { currentEditor.updateText(idx, { font: fontSelect.value }) }
    }
    boldCheckbox.onchange = ()=>{
      const idx = currentEditor && currentEditor._selectedTextIndex
      if(currentEditor && idx >= 0) { currentEditor.updateText(idx, { fontWeight: boldCheckbox.checked ? 'bold' : '' }) }
    }
    colorInput.onchange = ()=>{
      const idx = currentEditor && currentEditor._selectedTextIndex
      if(currentEditor && idx >= 0) { currentEditor.updateText(idx, { color: colorInput.value }) }
    }
    sizeInput.onchange = ()=>{
      const idx = currentEditor && currentEditor._selectedTextIndex
      const v = parseInt(sizeInput.value) || 28
      if(currentEditor && idx >= 0) { currentEditor.updateText(idx, { fontSize: v }) }
    }
    deleteTextBtn.onclick = ()=>{
      const idx = currentEditor && currentEditor._selectedTextIndex
      if(currentEditor && idx >= 0){ currentEditor.deleteText(idx); syncControlsFromEditor() }
    }

    const updateUndoRedoState = ()=>{
      try{
        undoBtn.disabled = !(currentEditor && currentEditor.canUndo)
        redoBtn.disabled = !(currentEditor && currentEditor.canRedo)
      }catch(e){}
    }

    undoBtn.onclick = ()=>{ if(currentEditor){ currentEditor.undo(); syncControlsFromEditor(); updateUndoRedoState() } }
    redoBtn.onclick = ()=>{ if(currentEditor){ currentEditor.redo(); syncControlsFromEditor(); updateUndoRedoState() } }
    // initialize state
    updateUndoRedoState()

    // keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Y)
    window._editorKeyHandler = (ev)=>{
      if(!editorModal || editorModal.style.display === 'none') return
      const meta = ev.ctrlKey || ev.metaKey
      if(!meta) return
      // Z = undo, Y = redo (Shift+Z -> redo on some platforms)
      if(ev.key === 'z' || ev.key === 'Z'){
        ev.preventDefault()
        if(ev.shift){ if(currentEditor && currentEditor.redo){ currentEditor.redo(); syncControlsFromEditor(); updateUndoRedoState() } }
        else { if(currentEditor && currentEditor.undo){ currentEditor.undo(); syncControlsFromEditor(); updateUndoRedoState() } }
      } else if(ev.key === 'y' || ev.key === 'Y'){
        ev.preventDefault()
        if(currentEditor && currentEditor.redo){ currentEditor.redo(); syncControlsFromEditor(); updateUndoRedoState() }
      }
    }
    window.addEventListener('keydown', window._editorKeyHandler)
  }catch(err){
    console.error('加载图片到编辑器失败', err)
    alert('无法加载图片到编辑器')
    closeEditor()
  }
}

function closeEditor(){
  hideEditorModal()
  if(editorContainer) editorContainer.innerHTML = ''
  // remove keyboard handler if set
  try{ if(window._editorKeyHandler) window.removeEventListener('keydown', window._editorKeyHandler) }catch(e){}
  window._editorKeyHandler = null
  try{ window.currentEditor = null }catch(e){}
  currentEditor = null
  currentItem = null
}

function syncControlsFromEditor(){
  if(!currentEditor) return
  const f = currentEditor.filters || {}
  Object.keys(sliders).forEach(name=>{
    const el = sliders[name]
    if(!el) return
    if(typeof f[name] !== 'undefined') el.value = f[name]
  })
  // sync text controls if available
  try{
    const idx = currentEditor._selectedTextIndex
    const fontSelect = document.getElementById('textFont')
    const boldCheckbox = document.getElementById('textBold')
    const colorInput = document.getElementById('textColor')
    const sizeInput = document.getElementById('textSize')
    const deleteTextBtn = document.getElementById('deleteTextBtn')
    if(idx >= 0 && currentEditor.textLayers && currentEditor.textLayers[idx]){
      const layer = currentEditor.textLayers[idx]
      if(fontSelect) fontSelect.value = layer.font || 'sans-serif'
      if(boldCheckbox) boldCheckbox.checked = (layer.fontWeight === 'bold')
      if(colorInput) try{ colorInput.value = layer.color || '#ffffff' }catch(e){}
      if(sizeInput) sizeInput.value = layer.fontSize || 28
      if(deleteTextBtn) deleteTextBtn.disabled = false
    }else{
      if(deleteTextBtn) deleteTextBtn.disabled = true
    }
  }catch(e){}
}

// Simple pull-to-refresh implementation (works on touch devices)
let startY = 0
let pulling = false
const pullEl = document.getElementById('pullToRefresh')

function setPullHeight(h){
  pullEl.style.height = h + 'px'
}

function refreshAction(){
  // simulate refresh: shuffle items and re-render
  state.items = state.items.sort(()=>Math.random()-0.5)
  renderGrid()
}

window.addEventListener('touchstart', (e)=>{
  if(window.scrollY === 0){
    startY = e.touches[0].clientY
    pulling = true
  }
})

window.addEventListener('touchmove', (e)=>{
  if(!pulling) return
  const delta = e.touches[0].clientY - startY
  if(delta > 0){
    setPullHeight(Math.min(delta,120))
  } else {
    setPullHeight(0)
  }
})

window.addEventListener('touchend', (e)=>{
  if(!pulling) return
  const endY = e.changedTouches[0].clientY
  const delta = endY - startY
  setPullHeight(0)
  pulling = false
  if(delta > 80){
    // show temporary loading
    pullEl.textContent = '刷新中…'
    pullEl.style.height = '40px'
    setTimeout(()=>{
      refreshAction()
      pullEl.style.height = '0'
      pullEl.textContent = '下拉刷新'
    }, 800)
  }
})

// Optional mouse-based pull-to-refresh for desktop testing
let mouseDown = false
window.addEventListener('mousedown', (e)=>{if(window.scrollY===0){mouseDown=true;startY=e.clientY}})
window.addEventListener('mousemove', (e)=>{
  if(!mouseDown) return
  const delta = e.clientY - startY
  if(delta>0) setPullHeight(Math.min(delta,120))
})
window.addEventListener('mouseup', (e)=>{
  if(!mouseDown) return
  mouseDown=false
  const delta = e.clientY - startY
  setPullHeight(0)
  if(delta>80){
    pullEl.textContent = '刷新中…'
    pullEl.style.height = '40px'
    setTimeout(()=>{
      refreshAction()
      pullEl.style.height = '0'
      pullEl.textContent = '下拉刷新'
    },800)
  }
})

// initial render
; (async ()=>{
  await loadUserUploads()
  renderFilters()
  renderGrid()
})()

// --- PWA: service worker registration ---
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('service-worker.js').catch(()=>{})
}

// --- Add-to-home-screen prompt handling ---
let deferredPrompt = null
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault()
  deferredPrompt = e
  installBtn.classList.add('show')
})
installBtn.addEventListener('click', async ()=>{
  if(!deferredPrompt) return
  deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice.catch(()=>null)
  deferredPrompt = null
  installBtn.classList.remove('show')
})

// --- Save image to device (best-effort) ---
async function saveImage(item){
  try{
    const resp = await fetch(item.url)
    const blob = await resp.blob()
    const file = new File([blob], `${item.title}.jpg`, {type: blob.type})

    // Prefer Web Share API with files (lets user save to Photos on iOS via share sheet)
    if(navigator.canShare && navigator.canShare({files:[file]}) && navigator.share){
      await navigator.share({files:[file], title: item.title})
      return
    }

    // Fallback: anchor download (works on many platforms but not iOS Photos)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${item.title}.jpg`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }catch(err){
    // On iOS Safari, best action is to instruct user to long-press the image
    alert('无法直接保存，请长按图片并选择“添加到照片”或使用分享功能。')
  }
}

// --- Background Sync helper: queue a request and register sync ---
async function queueForBackgroundSync(request){
  if(!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  // send message to service worker to store the request
  const message = { action: 'queue-request', request }
  try{
    if(reg.active) reg.active.postMessage(message)
    else if(navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage(message)
  }catch(e){}

  // register sync
  try{
    if('sync' in reg) await reg.sync.register('sync-requests')
  }catch(e){}
}

// Example: when offline and user taps "保存" we could enqueue a sync
// queueForBackgroundSync({ url: '/api/sync-favorite', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { id: 123 } })
