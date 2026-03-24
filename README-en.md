Wallpaper Gallery Demo

Description
- Responsive Grid: 3 columns by default, 2 columns when width < 1000px, 1 column when width < 600px.
- Lazy Loading: Uses `loading="lazy"` attribute and `IntersectionObserver`.
- Category Filtering: Top buttons filter by category or select "All".
- Search: Supports searching wallpapers by title and category.

Running
1. Open `index.html` directly in a browser to preview (no build or server required).
2. To run with a local file server (avoids browser restrictions on local files), use:

```bash
# Python 3
python3 -m http.server 8000
# Then visit http://localhost:8000
```

Customization
- Replace `demoData` in `app.js` with your API data. Image field is `url`, display title is `title`, category is `category`.

ImageEditor Example

```javascript
import ImageEditor from './image-editor.js'
const editor = new ImageEditor()
await editor.load('https://picsum.photos/800/600')
document.body.appendChild(editor.getElement())
editor.adjustImage('brightness', 1.1)
editor.addText('Sample', { x: 20, y: 20, fontSize: 36, color: '#fff' })
await editor.saveToLocal('edited.png')
```

Utility Functions (`utils.js`) Example

```javascript
import { compressImage, LocalStorageManager, isIOS, initThemeToggle } from './utils.js'

// Compress image
const compressed = await compressImage(fileInput.files[0], { maxWidth: 1200, quality: 0.9 })

// Local storage
const store = new LocalStorageManager('wallpaper')
store.set('demo', {a:1}, 3600 * 1000)

// iOS detection
console.log('is iOS?', isIOS())

// Theme toggle
initThemeToggle('#themeBtn')
```