/*
  Enhanced service worker
  - Precache core assets
  - Runtime caching: cache-first for static assets, network-first for API
  - Background Sync support: queue requests from page and retry in `sync` event
*/
const PRECACHE = 'precache-v4'
const RUNTIME = 'runtime'

const PRECACHE_URLS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'image-editor.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
]

// --- Minimal IndexedDB queue for background sync ---
function openDb(){
  return new Promise((res, rej)=>{
    const r = indexedDB.open('bg-sync-db', 1)
    r.onupgradeneeded = ()=>{
      r.result.createObjectStore('requests', {keyPath: 'id', autoIncrement: true})
    }
    r.onsuccess = ()=>res(r.result)
    r.onerror = ()=>rej(r.error)
  })
}

async function enqueueRequest(obj){
  const db = await openDb()
  return new Promise((res, rej)=>{
    const tx = db.transaction('requests', 'readwrite')
    tx.objectStore('requests').add(obj)
    tx.oncomplete = ()=>res()
    tx.onerror = ()=>rej(tx.error)
  })
}

async function getAllQueued(){
  const db = await openDb()
  return new Promise((res, rej)=>{
    const tx = db.transaction('requests', 'readonly')
    const req = tx.objectStore('requests').getAll()
    req.onsuccess = ()=>res(req.result || [])
    req.onerror = ()=>rej(req.error)
  })
}

async function deleteQueued(id){
  const db = await openDb()
  return new Promise((res, rej)=>{
    const tx = db.transaction('requests', 'readwrite')
    tx.objectStore('requests').delete(id)
    tx.oncomplete = ()=>res()
    tx.onerror = ()=>rej(tx.error)
  })
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE).then(cache => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== PRECACHE && k !== RUNTIME).map(k => caches.delete(k))
    ))
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const req = event.request
  const url = new URL(req.url)

  // Network-first for API calls
  if(url.pathname.startsWith('/api') || url.search.includes('api')){
    event.respondWith(
      fetch(req).then(resp => {
        const copy = resp.clone()
        caches.open(RUNTIME).then(cache => cache.put(req, copy))
        return resp
      }).catch(()=>caches.match(req).then(r=>r || caches.match('index.html')))
    )
    return
  }

  // For navigation, respond with precache index.html fallback
  if(req.mode === 'navigate'){
    event.respondWith(
      caches.match('index.html').then(cached => cached || fetch(req).then(resp => {
        const copy = resp.clone()
        caches.open(RUNTIME).then(cache => cache.put(req, copy))
        return resp
      }).catch(()=>caches.match('index.html')))
    )
    return
  }

  // Cache-first for static assets (css/js/images)
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      // avoid caching cross-origin opaque responses unless needed
      if(resp && resp.type !== 'opaque'){
        const copy = resp.clone()
        caches.open(RUNTIME).then(cache => cache.put(req, copy))
      }
      return resp
    }).catch(()=>caches.match(req)))
  )
})

// Message handler from page to queue requests for BG sync
self.addEventListener('message', (ev)=>{
  const data = ev.data || {}
  if(data && data.action === 'queue-request' && data.request){
    // store minimal request info
    enqueueRequest(data.request).catch(()=>{})
  }
})

// Background Sync event
self.addEventListener('sync', (event) => {
  if(event.tag === 'sync-requests'){
    event.waitUntil(
      (async ()=>{
        const entries = await getAllQueued()
        for(const e of entries){
          try{
            const headers = new Headers(e.request.headers || {})
            const body = e.request.body ? JSON.stringify(e.request.body) : undefined
            const resp = await fetch(e.request.url, { method: e.request.method || 'POST', headers, body })
            if(resp && resp.ok){
              await deleteQueued(e.id)
            }
          }catch(err){
            // keep in queue for next sync
          }
        }
      })()
    )
  }
})
