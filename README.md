壁纸网格展示 Demo

说明
- 响应式网格：默认每行 3 列，宽度小于 1000px 时 2 列，小于 600px 时 1 列。
- 图片懒加载：使用 `loading=”lazy”` 与 `IntersectionObserver`。
- 分类筛选：顶部按钮可筛选分类或选择”全部”。
- 搜索功能：支持按标题和分类搜索壁纸。

运行
1. 在浏览器中打开 `index.html` 即可预览（无需构建或服务器）。
2. 若要在本地以文件服务器方式运行（可避免某些浏览器对本地文件的限制），使用例如：

```bash
# Python 3
python3 -m http.server 8000
# 然后访问 http://localhost:8000
```

自定义
- 将 `app.js` 中 `demoData` 替换为你的 API 数据。图片字段为 `url`，显示标题为 `title`，分类为 `category`。

ImageEditor 示例

```
import ImageEditor from './image-editor.js'
const editor = new ImageEditor()
await editor.load('https://picsum.photos/800/600')
document.body.appendChild(editor.getElement())
editor.adjustImage('brightness', 1.1)
editor.addText('示例', { x: 20, y: 20, fontSize: 36, color: '#fff' })
await editor.saveToLocal('edited.png')
```

工具函数（`utils.js`）示例

```
import { compressImage, LocalStorageManager, isIOS, initThemeToggle } from './utils.js'

// 压缩
const compressed = await compressImage(fileInput.files[0], { maxWidth: 1200, quality: 0.9 })

// 本地存储
const store = new LocalStorageManager('wallpaper')
store.set('demo', {a:1}, 3600 * 1000)

// iOS 检测
console.log('is iOS?', isIOS())

// 主题切换
initThemeToggle('#themeBtn')
```
