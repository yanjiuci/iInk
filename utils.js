// utils.js
// Exports:
// - compressImage(fileOrUrl, options) -> Promise<Blob>
// - LocalStorageManager
// - isIOS()
// - theme helpers: applyTheme(theme), toggleTheme(), initThemeToggle(selector)

export async function _loadImage(src){
  return new Promise((resolve, reject)=>{
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = ()=>resolve(img)
    img.onerror = reject
    if(src instanceof Blob || src instanceof File){
      const url = URL.createObjectURL(src)
      img.src = url
      img._objectUrl = url
    } else if(typeof src === 'string'){
      img.src = src
    } else if(src instanceof HTMLImageElement){
      resolve(src)
      return
    } else return reject(new Error('Unsupported image source'))
  })
}

export async function compressImage(input, {maxWidth = 1920, maxHeight = 1920, quality = 0.92, mimeType} = {}){
  // input: File/Blob | url string | HTMLImageElement
  const img = await _loadImage(input)
  // calculate size while preserving aspect ratio
  let {width, height} = img
  let ratio = Math.min(1, maxWidth / width, maxHeight / height)
  const targetWidth = Math.max(1, Math.round(width * ratio))
  const targetHeight = Math.max(1, Math.round(height * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

  const type = mimeType || 'image/jpeg'
  return await new Promise((resolve, reject)=>{
    canvas.toBlob((blob)=>{
      // revoke object url if created
      if(img._objectUrl) URL.revokeObjectURL(img._objectUrl)
      if(!blob) return reject(new Error('Compression failed'))
      resolve(blob)
    }, type, quality)
  })
}

// LocalStorageManager - simple wrapper with optional TTL
export class LocalStorageManager{
  constructor(prefix = 'app'){
    this.prefix = prefix + ':'
  }

  _key(key){ return this.prefix + key }

  set(key, value, ttlMs = 0){
    const payload = {v: value}
    if(ttlMs && ttlMs > 0) payload.e = Date.now() + ttlMs
    try{
      localStorage.setItem(this._key(key), JSON.stringify(payload))
      return true
    }catch(e){
      return false
    }
  }

  get(key, defaultValue = null){
    const raw = localStorage.getItem(this._key(key))
    if(!raw) return defaultValue
    try{
      const parsed = JSON.parse(raw)
      if(parsed.e && Date.now() > parsed.e){
        localStorage.removeItem(this._key(key))
        return defaultValue
      }
      return parsed.v
    }catch(e){
      return defaultValue
    }
  }

  remove(key){
    localStorage.removeItem(this._key(key))
  }

  clear(){
    const keys = Object.keys(localStorage)
    for(const k of keys){
      if(k.startsWith(this.prefix)) localStorage.removeItem(k)
    }
  }

  keys(){
    return Object.keys(localStorage).filter(k=>k.startsWith(this.prefix)).map(k=>k.slice(this.prefix.length))
  }
}

// isIOS detection (covers iPhone/iPad/iPod and iPadOS desktop UA)
export function isIOS(){
  if(typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''
  const isIPhone = /iPhone/.test(platform)
  const isIPod = /iPod/.test(platform)
  const isIPad = /iPad/.test(platform)
  // iPadOS 13+ reports MacIntel but has touch points
  const isIpadOS = (platform === 'MacIntel' && navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
  return isIPhone || isIPod || isIPad || isIpadOS || /iPhone|iPad|iPod/.test(ua)
}

// Theme switching helpers
const THEME_KEY = 'theme:preference'
const storage = new LocalStorageManager('wallpaper')

export function applyTheme(theme){
  // theme: 'dark' | 'light' | 'system'
  const root = document.documentElement
  if(theme === 'system'){
    // remove explicit attribute; rely on prefers-color-scheme
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', theme)
  }
  storage.set(THEME_KEY, theme)
  // update theme-color meta if available
  const meta = document.querySelector('meta[name="theme-color"]')
  if(meta){
    meta.content = theme === 'dark' ? '#000000' : '#0b74ff'
  }
}

export function toggleTheme(){
  const cur = storage.get(THEME_KEY, 'system')
  const next = cur === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}

export function initThemeToggle(buttonSelector){
  const btn = document.querySelector(buttonSelector)
  if(btn){
    btn.addEventListener('click', ()=>{
      const next = toggleTheme()
      // update UI if button supports label
      if(btn.tagName === 'BUTTON') btn.textContent = next === 'dark' ? '切换到浅色' : '切换到深色'
    })
  }
  // set initial theme from stored preference or system
  const pref = storage.get(THEME_KEY, 'system')
  if(pref === 'system'){
    // use matchMedia
    const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(dark ? 'dark' : 'light')
  } else applyTheme(pref)
}

/* Example usage:
import { compressImage, LocalStorageManager, isIOS, initThemeToggle } from './utils.js'
const blob = await compressImage(fileInput.files[0], { maxWidth: 1200, quality: 0.9 })
const ls = new LocalStorageManager('myapp')
ls.set('token', 'abc', 24*3600*1000)
console.log(isIOS())
initThemeToggle('#themeBtn')
*/
