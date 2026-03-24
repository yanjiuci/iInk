// 本地壁纸数据 - 从壁纸文件夹加载
const demoData = (()=>{
  const arr = []
  let id = 1
  
  // 书法福系列
  const calligraphyImages = ['13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg']
  calligraphyImages.forEach((filename, idx) => {
    arr.push({
      id: id++,
      title: `书法福 ${idx + 1}`,
      category: '书法',
      url: `./书法福/${filename}`
    })
  })
  
  // 熊猫系列
  const pandaImages = [
    { file: '冬.jpg', name: '熊猫-冬' },
    { file: '夏.jpg', name: '熊猫-夏' },
    { file: '新年.jpg', name: '熊猫-新年' },
    { file: '春.jpg', name: '熊猫-春' },
    { file: '秋.jpg', name: '熊猫-秋' }
  ]
  pandaImages.forEach((item) => {
    arr.push({
      id: id++,
      title: item.name,
      category: '熊猫',
      url: `./熊猫/${item.file}`
    })
  })
  
  // 物体福系列
  const objectImages = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg']
  objectImages.forEach((filename, idx) => {
    arr.push({
      id: id++,
      title: `物体福 ${idx + 1}`,
      category: '创意',
      url: `./物体福/${filename}`
    })
  })
  
  return arr
})()

const state = {
  items: demoData,
  filter: '全部',
  searchQuery: ''
}

import ImageEditor from './image-editor.js'
import { compressImage, LocalStorageManager } from './utils.js'

const grid = document.getElementById('grid')
const searchInput = document.getElementById('searchInput')
const template = document.getElementById('tile-template')
const installBtn = document.getElementById('installBtn')
// user profile / upload elements
const userBtn = document.getElementById('userBtn')
const userModal = document.getElementById('userModal')
const userClose = document.getElementById('userClose')
const uploadInput = document.getElementById('uploadInput')
const uploadGallery = document.getElementById('uploadGallery')
const userAvatarPreview = document.getElementById('userAvatarPreview')
const userAvatarInput = document.getElementById('userAvatarInput')
const userNickname = document.getElementById('userNickname')
const userSaveProfile = document.getElementById('userSaveProfile')

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
const editorUndo = document.getElementById('editorUndo')
const editorRedo = document.getElementById('editorRedo')
const editorReset = document.getElementById('editorReset')

// Tool panels
const adjustPanel = document.getElementById('adjustPanel')
const filterPanel = document.getElementById('filterPanel')
const cropPanel = document.getElementById('cropPanel')
const textPanel = document.getElementById('textPanel')
const stickerPanel = document.getElementById('stickerPanel')

// Adjustment sliders
const sliders = {
  brightness: document.getElementById('slider-brightness'),
  contrast: document.getElementById('slider-contrast'),
  saturate: document.getElementById('slider-saturate'),
  blur: document.getElementById('slider-blur'),
  hue: document.getElementById('slider-hue'),
  warmth: document.getElementById('slider-warmth'),
  tint: document.getElementById('slider-tint'),
  vibrance: document.getElementById('slider-vibrance'),
  highlights: document.getElementById('slider-highlights'),
  shadows: document.getElementById('slider-shadows'),
  vignette: document.getElementById('slider-vignette'),
  opacity: document.getElementById('slider-opacity')
}

// Text editor elements
const editorText = document.getElementById('editorText')
const editorFont = document.getElementById('editorFont')
const editorFontSize = document.getElementById('editorFontSize')
const editorFontSizeValue = document.getElementById('editorFontSizeValue')
const editorTextColor = document.getElementById('editorTextColor')
const textBold = document.getElementById('textBold')
const textItalic = document.getElementById('textItalic')
const textRotation = document.getElementById('textRotation')
const textRotationValue = document.getElementById('textRotationValue')
const textOpacity = document.getElementById('textOpacity')
const textStroke = document.getElementById('textStroke')
const textShadow = document.getElementById('textShadow')
const addTextBtn = document.getElementById('addTextBtn')
const layerList = document.getElementById('layerList')

// Action buttons
const editorSaveBtn = document.getElementById('editorSaveBtn')
const editorExportBtn = document.getElementById('editorExportBtn')
const rotateLeft = document.getElementById('rotateLeft')
const rotateRight = document.getElementById('rotateRight')
const flipH = document.getElementById('flipH')
const flipV = document.getElementById('flipV')

let currentEditor = null
let currentItem = null

// Local persistence for user uploads
const userStore = new LocalStorageManager('user')
const USER_UPLOADS_KEY = 'uploads'
const USER_PROFILE_KEY = 'profile'
// interactions store (likes & comments)
const interactionStore = new LocalStorageManager('interaction')
const INTERACTIONS_KEY = 'interactions'
let interactions = interactionStore.get(INTERACTIONS_KEY, {}) || {}

function saveInteractions(){ interactionStore.set(INTERACTIONS_KEY, interactions) }

function getInteraction(id){ return interactions[String(id)] || { liked: false, likes: 0, comments: [], collected: false, collects: 0, downloads: 0 } }

function toggleLikeById(id){
  const key = String(id)
  interactions[key] = interactions[key] || { liked:false, likes:0, comments:[], collected:false, collects:0, downloads:0 }
  interactions[key].liked = !interactions[key].liked
  if(interactions[key].liked) interactions[key].likes = (interactions[key].likes||0) + 1
  else interactions[key].likes = Math.max(0, (interactions[key].likes||0) - 1)
  saveInteractions()
  updateProfileStats()
  return interactions[key]
}

// 收藏功能
function toggleCollectById(id){
  const key = String(id)
  interactions[key] = interactions[key] || { liked:false, likes:0, comments:[], collected:false, collects:0, downloads:0 }
  interactions[key].collected = !interactions[key].collected
  if(interactions[key].collected) interactions[key].collects = (interactions[key].collects||0) + 1
  else interactions[key].collects = Math.max(0, (interactions[key].collects||0) - 1)
  saveInteractions()
  updateProfileStats()
  return interactions[key]
}

function addCommentToId(id, text){
  const key = String(id)
  interactions[key] = interactions[key] || { liked:false, likes:0, comments:[], collected:false, collects:0, downloads:0 }
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

function saveUserProfile(profile){
  userStore.set(USER_PROFILE_KEY, profile)
}

function getUserProfile(){
  return userStore.get(USER_PROFILE_KEY, { nickname: '', avatar: null, bio: '' })
}

function renderUserProfile(){
  const p = getUserProfile()
  if(userNickname) userNickname.value = p.nickname || ''
  if(userAvatarPreview) userAvatarPreview.src = p.avatar || 'icons/icon.svg'
  // 渲染简介
  const userBio = document.getElementById('userBio')
  if(userBio) userBio.value = p.bio || ''
  updateUserButton(p)
  updateProfileStats()
}

async function handleAvatarSelected(ev){
  const f = (ev.target.files && ev.target.files[0]) || null
  if(!f) return
  try{
    const compressed = await compressImage(f, { maxWidth: 512, quality: 0.9 })
    const dataUrl = await blobToDataURL(compressed)
    if(userAvatarPreview) userAvatarPreview.src = dataUrl
  }catch(e){ console.error('处理头像失败', e) }
}

function handleSaveProfile(){
  const nick = (userNickname && userNickname.value && userNickname.value.trim()) || ''
  const avatar = (userAvatarPreview && userAvatarPreview.src) || null
  const userBioEl = document.getElementById('userBio')
  const bio = (userBioEl && userBioEl.value && userBioEl.value.trim()) || ''

  saveUserProfile({ nickname: nick, avatar, bio })
  updateUserButton({ nickname: nick, avatar })
  updateProfileStats()
  alert('已保存个人资料')
}

function updateUserButton(profile){
  if(!userBtn) return
  const nick = (profile && profile.nickname) || ''
  const avatar = (profile && profile.avatar) || null
  if(avatar){
    userBtn.innerHTML = `<img src="${avatar}" style="width:20px;height:20px;border-radius:50%;vertical-align:middle;margin-right:6px"> ${nick || '个人中心'}`
  } else if(nick){
    userBtn.innerHTML = `<span style="width:20px;height:20px;border-radius:50%;vertical-align:middle;margin-right:6px;display:inline-block;background:#ddd;text-align:center;line-height:20px;font-size:12px;">${nick.charAt(0)}</span> ${nick}`
  } else {
    userBtn.innerHTML = '<span style="width:20px;height:20px;border-radius:50%;vertical-align:middle;margin-right:6px;display:inline-block;background:#ddd;text-align:center;line-height:20px;">👤</span> 个人中心'
  }

  // 更新头部导航的头像
  const headerAvatar = document.getElementById('headerAvatar')
  const headerNickname = document.getElementById('headerNickname')
  if(headerAvatar && avatar){
    headerAvatar.style.backgroundImage = `url(${avatar})`
    headerAvatar.style.backgroundSize = 'cover'
    headerAvatar.textContent = ''
  } else if(headerNickname) {
    headerNickname.textContent = nick || '个人中心'
  }
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
const previewTitle = document.getElementById('previewTitle')

// 当前预览的图片索引
let currentPreviewIndex = 0
let previewItems = []

// 显示预览（小红书风格）
function showPreview(item, clickEvent) {
  if(!previewModal || !previewImage) return

  // 获取当前筛选下的所有图片
  const items = state.filter === '全部' ? state.items : state.items.filter(i=>i.category===state.filter)
  previewItems = items
  currentPreviewIndex = items.findIndex(i => i.id === item.id)

  // 设置图片和标题
  previewImage.src = item.url
  previewImage.alt = item.title
  if(previewTitle) previewTitle.textContent = item.title

  // 显示模态框
  previewModal.style.display = 'block'
  previewModal.setAttribute('aria-hidden','false')

  // 添加进入动画
  requestAnimationFrame(() => {
    previewModal.classList.add('preview-active')
  })
}

function hidePreview(){
  if(!previewModal) return
  previewModal.classList.remove('preview-active')
  setTimeout(() => {
    previewModal.style.display = 'none'
    previewModal.setAttribute('aria-hidden','true')
    if(previewImage) previewImage.src = ''
  }, 300)
}

// 键盘导航
function navigatePreview(direction) {
  if (previewItems.length === 0) return

  currentPreviewIndex += direction
  if (currentPreviewIndex < 0) currentPreviewIndex = previewItems.length - 1
  if (currentPreviewIndex >= previewItems.length) currentPreviewIndex = 0

  const item = previewItems[currentPreviewIndex]
  previewImage.src = item.url
  previewImage.alt = item.title
  if(previewTitle) previewTitle.textContent = item.title
}

if(previewClose) previewClose.addEventListener('click', hidePreview)
if(previewBackdrop) previewBackdrop.addEventListener('click', hidePreview)

// 导航按钮
const prevBtn = document.getElementById('prevBtn')
const nextBtn = document.getElementById('nextBtn')
if(prevBtn) prevBtn.addEventListener('click', () => navigatePreview(-1))
if(nextBtn) nextBtn.addEventListener('click', () => navigatePreview(1))

function renderGrid(){
  clearGrid()

  // 先按分类筛选，再按搜索关键词筛选
  let items = state.filter === '全部' ? state.items : state.items.filter(i=>i.category===state.filter)

  // 搜索过滤
  if (state.searchQuery.trim()) {
    const query = state.searchQuery.toLowerCase().trim()
    items = items.filter(item =>
      item.title.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    )
  }

  if(items.length === 0){
    const el = document.createElement('div')
    el.className = 'loading'
    el.textContent = state.searchQuery ? '未找到匹配的壁纸' : '无可显示的壁纸'
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

    // like/comment/collect/share/download UI
    const likeBtn = node.querySelector('.like-btn')
    const likeCount = node.querySelector('.like-count')
    const commentCount = node.querySelector('.comment-count')
    const commentBtn = node.querySelector('.comment-btn')
    const collectBtn = node.querySelector('.collect-btn')
    const collectCount = node.querySelector('.collect-count')
    const shareBtn = node.querySelector('.share-btn')
    const downloadBtn = node.querySelector('.download-btn')
    const downloadCount = node.querySelector('.download-count')
    try{
      const info = getInteraction(item.id)
      if(likeCount) likeCount.textContent = info.likes || 0
      if(commentCount) commentCount.textContent = (info.comments && info.comments.length) || 0
      if(collectCount) collectCount.textContent = info.collects || 0
      if(downloadCount) downloadCount.textContent = info.downloads || 0
      if(likeBtn) { if(info.liked) { likeBtn.classList.add('active'); likeBtn.textContent = '♥' } else { likeBtn.textContent = '♡' } }
      if(collectBtn) { if(info.collected) { collectBtn.classList.add('active'); collectBtn.textContent = '★' } else { collectBtn.textContent = '☆' } }
      if(likeBtn) likeBtn.addEventListener('click', ()=>{
        const res = toggleLikeById(item.id)
        if(likeCount) likeCount.textContent = res.likes
        if(likeBtn) { if(res.liked) { likeBtn.classList.add('active'); likeBtn.textContent = '♥' } else { likeBtn.classList.remove('active'); likeBtn.textContent = '♡' } }
      })
      if(collectBtn) collectBtn.addEventListener('click', ()=>{
        const res = toggleCollectById(item.id)
        if(collectCount) collectCount.textContent = res.collects
        if(collectBtn) { if(res.collected) { collectBtn.classList.add('active'); collectBtn.textContent = '★' } else { collectBtn.classList.remove('active'); collectBtn.textContent = '☆' } }
      })
      if(commentBtn) commentBtn.addEventListener('click', ()=> openCommentModalFor(item))
      // 分享功能
      if(shareBtn) shareBtn.addEventListener('click', ()=> shareImage(item))
      // 下载功能
      if(downloadBtn) downloadBtn.addEventListener('click', ()=> saveImage(item))
    }catch(e){}

    // Use data-src + loading=lazy attribute to defer load
    img.dataset.src = item.url
    img.alt = item.title
    img.loading = 'lazy'
    img.addEventListener('error', ()=>{img.style.background = '#f2f2f2'})

    // 点击打开全屏预览（小红书风格）
    img.addEventListener('click', (e) => showPreview(item, e))

    grid.appendChild(node)
    // Observe last appended image
    const appendedImg = grid.lastElementChild.querySelector('.tile-img')
    if(appendedImg) io.observe(appendedImg)
  })
}

// --- User modal handlers ---
function showUserModal(){ if(!userModal) return; userModal.style.display = 'block'; userModal.setAttribute('aria-hidden','false'); renderUploadGallery(); renderUserProfile() }
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
  renderGrid()
  renderUploadGallery()
  // clear input
  uploadInput.value = ''
})

// profile wiring
if(userAvatarInput) userAvatarInput.addEventListener('change', handleAvatarSelected)
if(userSaveProfile) userSaveProfile.addEventListener('click', handleSaveProfile)

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
  if(editorContainer) editorContainer.innerHTML = ''
  
  try{
    currentEditor = new ImageEditor()
    await currentEditor.load(item.url)
    try{ window.currentEditor = currentEditor }catch(e){}
    if(editorContainer) editorContainer.appendChild(currentEditor.getElement())
    
    // Initialize UI
    syncControlsFromEditor()
    updateLayerList()
    updateUndoRedoButtons()
    
    // Setup all event handlers
    setupEditorEventHandlers()
    
  }catch(err){
    console.error('加载图片到编辑器失败', err)
    alert('无法加载图片到编辑器')
    closeEditor()
  }
}

function setupEditorEventHandlers(){
  if(!currentEditor) return
  
  // Tool switching
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tool-btn').forEach(b => {
        b.classList.remove('active')
        b.style.background = 'transparent'
        b.style.color = '#999'
      })
      btn.classList.add('active')
      btn.style.background = '#333'
      btn.style.color = '#fff'
      
      // Show corresponding panel
      const tool = btn.dataset.tool
      document.querySelectorAll('.tool-panel').forEach(p => p.style.display = 'none')
      const panel = document.getElementById(tool + 'Panel')
      if(panel) panel.style.display = 'block'
    }
  })
  
  // Adjustment sliders
  Object.keys(sliders).forEach(name => {
    const el = sliders[name]
    if(!el) return
    el.oninput = () => {
      const val = parseFloat(el.value)
      currentEditor.adjustImage(name, val)
      updateValueDisplay(name, val)
    }
  })
  
  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      const filter = btn.dataset.filter
      currentEditor.applyFilter(filter)
      syncControlsFromEditor()
    }
  })
  
  // Canvas transforms
  if(rotateLeft) rotateLeft.onclick = () => currentEditor.rotateCanvas(-90)
  if(rotateRight) rotateRight.onclick = () => currentEditor.rotateCanvas(90)
  if(flipH) flipH.onclick = () => currentEditor.flipHorizontal()
  if(flipV) flipV.onclick = () => currentEditor.flipVertical()
  
  // Text controls
  if(editorFontSize) {
    editorFontSize.oninput = () => {
      if(editorFontSizeValue) editorFontSizeValue.textContent = editorFontSize.value + 'px'
    }
  }
  
  if(textRotation) {
    textRotation.oninput = () => {
      if(textRotationValue) textRotationValue.textContent = textRotation.value + '°'
    }
  }
  
  if(addTextBtn) {
    addTextBtn.onclick = () => {
      const txt = editorText && editorText.value.trim()
      if(!txt) return
      
      const options = {
        x: currentEditor.canvas.width / 2,
        y: currentEditor.canvas.height / 2,
        fontSize: editorFontSize ? parseInt(editorFontSize.value) : 48,
        font: editorFont ? editorFont.value : 'sans-serif',
        color: editorTextColor ? editorTextColor.value : '#fff',
        bold: textBold ? textBold.classList.contains('active') : false,
        italic: textItalic ? textItalic.classList.contains('active') : false,
        rotation: textRotation ? parseInt(textRotation.value) : 0,
        opacity: textOpacity ? parseFloat(textOpacity.value) : 1,
        stroke: { 
          enabled: textStroke ? textStroke.checked : true, 
          width: 2, 
          color: 'rgba(0,0,0,0.6)' 
        },
        shadow: { 
          enabled: textShadow ? textShadow.checked : true, 
          blur: 6, 
          color: 'rgba(0,0,0,0.3)', 
          offsetX: 0, 
          offsetY: 2 
        }
      }
      
      currentEditor.addText(txt, options)
      updateLayerList()
      if(editorText) editorText.value = ''
    }
  }
  
  // Toggle buttons
  if(textBold) {
    textBold.onclick = () => {
      textBold.classList.toggle('active')
      textBold.style.background = textBold.classList.contains('active') ? '#0b74ff' : '#333'
    }
  }
  
  if(textItalic) {
    textItalic.onclick = () => {
      textItalic.classList.toggle('active')
      textItalic.style.background = textItalic.classList.contains('active') ? '#0b74ff' : '#333'
    }
  }
  
  // Sticker buttons
  document.querySelectorAll('.sticker-btn').forEach(btn => {
    btn.onclick = async () => {
      const emoji = btn.dataset.emoji
      // Create emoji as sticker using canvas
      const canvas = document.createElement('canvas')
      canvas.width = 100
      canvas.height = 100
      const ctx = canvas.getContext('2d')
      ctx.font = '80px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(emoji, 50, 55)
      
      const dataUrl = canvas.toDataURL()
      await currentEditor.addSticker(dataUrl, {
        width: 80,
        height: 80
      })
      updateLayerList()
    }
  })
  
  // Undo/Redo/Reset
  if(editorUndo) editorUndo.onclick = () => {
    currentEditor.undo()
    syncControlsFromEditor()
    updateUndoRedoButtons()
  }
  
  if(editorRedo) editorRedo.onclick = () => {
    currentEditor.redo()
    syncControlsFromEditor()
    updateUndoRedoButtons()
  }
  
  if(editorReset) editorReset.onclick = () => {
    currentEditor.reset()
    syncControlsFromEditor()
    updateLayerList()
  }
  
  // Save/Export
  if(editorSaveBtn) {
    editorSaveBtn.onclick = () => {
      const fname = `${currentItem.title.replace(/[^a-z0-9-_]/ig,'') || 'image'}-edited.png`
      currentEditor.saveToLocal(fname).catch(() => alert('保存失败'))
    }
  }
  
  if(editorExportBtn) {
    editorExportBtn.onclick = async () => {
      try{
        const blob = await currentEditor.exportImage('image/png', 0.92)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${currentItem.title}-export.png`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      }catch(e){console.error(e)}
    }
  }
  
  // Selection change callback
  currentEditor.onSelectionChange = (idx, layer) => {
    updateLayerList()
  }
  
  // Keyboard shortcuts
  window._editorKeyHandler = (ev) => {
    if(!editorModal || editorModal.style.display === 'none') return
    const meta = ev.ctrlKey || ev.metaKey
    if(!meta) return
    
    if(ev.key === 'z' || ev.key === 'Z'){
      ev.preventDefault()
      if(ev.shiftKey) {
        currentEditor.redo()
      } else {
        currentEditor.undo()
      }
      syncControlsFromEditor()
      updateUndoRedoButtons()
    } else if(ev.key === 'y' || ev.key === 'Y'){
      ev.preventDefault()
      currentEditor.redo()
      syncControlsFromEditor()
      updateUndoRedoButtons()
    } else if(ev.key === 'Delete' || ev.key === 'Backspace'){
      const idx = currentEditor.selectedLayerIndex
      if(idx >= 0){
        currentEditor.deleteLayer(idx)
        updateLayerList()
      }
    }
  }
  window.addEventListener('keydown', window._editorKeyHandler)
}

function updateValueDisplay(name, val){
  const displayMap = {
    brightness: v => Math.round(v * 100) + '%',
    contrast: v => Math.round(v * 100) + '%',
    saturate: v => Math.round(v * 100) + '%',
    blur: v => v + 'px',
    hue: v => v + '°',
    warmth: v => v,
    tint: v => v,
    vibrance: v => v,
    highlights: v => v,
    shadows: v => v,
    vignette: v => Math.round(v * 100) + '%',
    opacity: v => Math.round(v * 100) + '%'
  }
  const el = document.getElementById('val-' + name)
  if(el && displayMap[name]) {
    el.textContent = displayMap[name](val)
  }
}

function updateUndoRedoButtons(){
  if(editorUndo) editorUndo.style.opacity = currentEditor.canUndo ? '1' : '0.5'
  if(editorRedo) editorRedo.style.opacity = currentEditor.canRedo ? '1' : '0.5'
}

function updateLayerList(){
  if(!layerList || !currentEditor) return
  
  layerList.innerHTML = ''
  currentEditor.layers.forEach((layer, idx) => {
    const item = document.createElement('div')
    item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px;background:#252525;border-radius:6px;margin-bottom:6px;cursor:pointer;'
    if(idx === currentEditor.selectedLayerIndex) {
      item.style.background = '#0b74ff'
    }
    
    const name = layer.type === 'text' ? `文字: ${layer.text.slice(0, 10)}${layer.text.length > 10 ? '...' : ''}` : '贴纸'
    item.innerHTML = `
      <span style="color:#fff;font-size:12px;">${name}</span>
      <div style="display:flex;gap:4px;">
        <button class="layer-up" data-idx="${idx}" style="padding:2px 6px;background:rgba(255,255,255,0.2);border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:10px;">↑</button>
        <button class="layer-down" data-idx="${idx}" style="padding:2px 6px;background:rgba(255,255,255,0.2);border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:10px;">↓</button>
        <button class="layer-delete" data-idx="${idx}" style="padding:2px 6px;background:rgba(255,0,0,0.5);border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:10px;">×</button>
      </div>
    `
    
    item.onclick = (e) => {
      if(e.target.tagName === 'BUTTON') return
      currentEditor._selectedLayerIndex = idx
      currentEditor._render()
      updateLayerList()
    }
    
    layerList.appendChild(item)
  })
  
  // Layer control buttons
  layerList.querySelectorAll('.layer-up').forEach(btn => {
    btn.onclick = () => {
      currentEditor.moveLayer(parseInt(btn.dataset.idx), 'up')
      updateLayerList()
    }
  })
  
  layerList.querySelectorAll('.layer-down').forEach(btn => {
    btn.onclick = () => {
      currentEditor.moveLayer(parseInt(btn.dataset.idx), 'down')
      updateLayerList()
    }
  })
  
  layerList.querySelectorAll('.layer-delete').forEach(btn => {
    btn.onclick = () => {
      currentEditor.deleteLayer(parseInt(btn.dataset.idx))
      updateLayerList()
    }
  })
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
  
  // Sync filter sliders
  const f = currentEditor.filters || {}
  Object.keys(sliders).forEach(name => {
    const el = sliders[name]
    if(!el) return
    if(typeof f[name] !== 'undefined') {
      el.value = f[name]
      updateValueDisplay(name, f[name])
    }
  })
}

// initial render
; (async ()=>{
  console.log('开始初始化...')
  await loadUserUploads()
  console.log('用户上传加载完成')
  renderGrid()
  console.log('网格渲染完成')
  initSearch()
  initCategoryTabs()
  console.log('分类标签初始化完成')
  updateProfileStats()
  console.log('统计更新完成')
})()

// 搜索功能初始化
function initSearch(){
  if(!searchInput) return
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value
    renderGrid()
  })
}

// 分类标签初始化
function initCategoryTabs(){
  const tabs = document.querySelectorAll('.category-tab')
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // 更新激活状态
      tabs.forEach(t => t.classList.remove('active'))
      tab.classList.add('active')

      // 更新筛选状态
      const category = tab.dataset.category
      state.filter = category
      renderGrid()
    })
  })

  // 菜单项点击事件
  const menuItems = document.querySelectorAll('.menu-item')
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const text = item.querySelector('div').textContent
      hideUserModal()

      if(text.includes('上传')){
        // 显示我的上传
        const uploads = userStore.get(USER_UPLOADS_KEY, []) || []
        const items = uploads.map(u => ({
          id: u.id,
          title: u.title || '上传图片',
          category: '上传',
          url: u.dataUrl
        }))
        showContentModal('我的上传', items, '暂无上传')
      } else if(text.includes('点赞')){
        // 显示我点赞的图片
        const items = getLikedItems()
        showContentModal('我的点赞', items, '还没有点赞任何图片')
      } else if(text.includes('评论')){
        // 显示我的评论
        const comments = getMyComments()
        const modal = document.getElementById('contentModal')
        const modalTitle = document.getElementById('contentModalTitle')
        const contentList = document.getElementById('contentList')

        modalTitle.textContent = '我的评论'
        if(comments.length === 0){
          contentList.innerHTML = '<div style="text-align:center;color:#999;padding:40px;">还没有评论过</div>'
        } else {
          contentList.innerHTML = ''
          comments.forEach(c => {
            const div = document.createElement('div')
            div.style.cssText = 'padding:10px;border-bottom:1px solid #eee;'
            div.innerHTML = `
              <div style="display:flex;gap:10px;align-items:center;margin-bottom:6px;">
                <img src="${c.itemUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">
                <div style="font-weight:500;font-size:13px;">${c.itemTitle}</div>
              </div>
              <div style="color:#333;font-size:14px;padding-left:50px;">${c.text}</div>
              <div style="color:#999;font-size:11px;padding-left:50px;margin-top:4px;">${new Date(c.date).toLocaleString()}</div>
            `
            contentList.appendChild(div)
          })
        }
        modal.style.display = 'block'
      } else if(text.includes('收藏')){
        // 显示我收藏的图片
        const items = getCollectedItems()
        showContentModal('我的收藏', items, '还没有收藏任何图片')
      }
    })
  })
}

// 更新个人中心统计数据
function updateProfileStats(){
  const uploads = userStore.get(USER_UPLOADS_KEY, []) || []
  let totalLikes = 0
  let totalComments = 0
  let totalCollects = 0
  let likedCount = 0
  let collectedCount = 0

  // 统计点赞、评论、收藏
  Object.values(interactions).forEach(item => {
    totalLikes += (item.likes || 0)
    totalComments += (item.comments ? item.comments.length : 0)
    totalCollects += (item.collects || 0)
    if(item.liked) likedCount++
    if(item.collected) collectedCount++
  })

  // 更新 DOM
  const statLikes = document.getElementById('statLikes')
  const statUploads = document.getElementById('statUploads')
  const statComments = document.getElementById('statComments')
  const statCollects = document.getElementById('statCollects')

  if(statLikes) statLikes.textContent = likedCount  // 显示点赞数
  if(statUploads) statUploads.textContent = uploads.length
  if(statComments) statComments.textContent = totalComments
  if(statCollects) statCollects.textContent = collectedCount
}

// 获取我点赞过的图片
function getLikedItems(){
  return state.items.filter(item => {
    const info = interactions[String(item.id)]
    return info && info.liked
  })
}

// 获取我收藏的图片
function getCollectedItems(){
  return state.items.filter(item => {
    const info = interactions[String(item.id)]
    return info && info.collected
  })
}

// 获取我的评论
function getMyComments(){
  const comments = []
  Object.entries(interactions).forEach(([id, data]) => {
    if(data.comments && data.comments.length > 0){
      data.comments.forEach(c => {
        const item = state.items.find(i => String(i.id) === id)
        comments.push({
          itemId: id,
          itemTitle: item ? item.title : '未知',
          itemUrl: item ? item.url : '',
          ...c
        })
      })
    }
  })
  return comments
}

// 显示内容列表弹窗
function showContentModal(title, items, emptyMsg){
  const modal = document.getElementById('contentModal')
  const modalTitle = document.getElementById('contentModalTitle')
  const contentList = document.getElementById('contentList')

  if(!modal || !modalTitle || !contentList) return

  modalTitle.textContent = title
  contentList.innerHTML = ''

  if(!items || items.length === 0){
    contentList.innerHTML = `<div style="text-align:center;color:#999;padding:40px;">${emptyMsg}</div>`
  } else {
    items.forEach(item => {
      const div = document.createElement('div')
      div.style.cssText = 'display:flex;gap:12px;padding:10px;border-bottom:1px solid #eee;cursor:pointer;'
      div.innerHTML = `
        <img src="${item.url}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;">
        <div style="flex:1;">
          <div style="font-weight:500;">${item.title}</div>
          <div style="font-size:12px;color:#999;">${item.category}</div>
        </div>
      `
      div.addEventListener('click', () => {
        modal.style.display = 'none'
        showPreview(item, {})
      })
      contentList.appendChild(div)
    })
  }

  modal.style.display = 'block'
}

function hideContentModal(){
  const modal = document.getElementById('contentModal')
  if(modal) modal.style.display = 'none'
}

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

    // 增加下载量计数
    const key = String(item.id)
    interactions[key] = interactions[key] || { liked:false, likes:0, comments:[], collected:false, collects:0, downloads:0 }
    interactions[key].downloads = (interactions[key].downloads||0) + 1
    saveInteractions()
    renderGrid()

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
    alert('无法直接保存，请长按图片并选择”添加到照片”或使用分享功能。')
  }
}

// 分享功能
async function shareImage(item){
  try{
    const resp = await fetch(item.url)
    const blob = await resp.blob()
    const file = new File([blob], `${item.title}.jpg`, {type: blob.type})

    if(navigator.canShare && navigator.canShare({files:[file]}) && navigator.share){
      await navigator.share({
        files: [file],
        title: item.title,
        text: `来自壁纸库的${item.title}`
      })
    } else {
      // 复制图片链接到剪贴板
      const url = URL.createObjectURL(blob)
      await navigator.clipboard.writeText(item.url)
      alert('图片链接已复制到剪贴板')
    }
  }catch(err){
    alert('分享失败，请重试')
  }
}

// 预览窗口键盘导航
window.addEventListener('keydown', (e) => {
  if (!previewModal || previewModal.style.display === 'none') return

  if (e.key === 'ArrowLeft') {
    navigatePreview(-1)
  } else if (e.key === 'ArrowRight') {
    navigatePreview(1)
  } else if (e.key === 'Escape') {
    hidePreview()
  }
})

// 触摸滑动支持
let touchStartX = 0
let touchEndX = 0

if (previewModal) {
  previewModal.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX
  }, { passive: true })

  previewModal.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX
    handleSwipe()
  }, { passive: true })
}

function handleSwipe() {
  const swipeThreshold = 50
  const diff = touchStartX - touchEndX

  if (Math.abs(diff) > swipeThreshold) {
    if (diff > 0) {
      // 向左滑 -> 下一张
      navigatePreview(1)
    } else {
      // 向右滑 -> 上一张
      navigatePreview(-1)
    }
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
