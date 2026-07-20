import { createApp, h } from 'vue'
import './styles/theme.css'
// 初始化主题（必须在挂载前执行）
import './composables/useTheme.js'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { ElConfigProvider } from 'element-plus'
import 'element-plus/dist/index.css'
import './styles/liquid-glass.css'
import './styles/interface-v2.css'
import './styles/workflow-unification.css'
import './styles/achromatic-ui.css'
import './styles/simple-mode.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'

// Electron 以查询参数标记桌面环境，仅在桌面端启用原生窗口拖拽与交通灯避让。
// 浏览器直接访问时不添加该 class，因此网页版的导航布局保持不变。
const DESKTOP_SHELL_KEY = 'cinegen.desktopShell'
const shellFromQuery = new URLSearchParams(window.location.search).get('desktop')
const shellFromPreload = window.cinegenWindow?.platform === 'darwin'
  ? 'mac'
  : window.cinegenWindow?.platform === 'win32'
    ? 'windows'
    : ''
const storedShell = window.sessionStorage.getItem(DESKTOP_SHELL_KEY) || ''
const desktopShell = shellFromPreload || shellFromQuery || storedShell
if (desktopShell) {
  window.sessionStorage.setItem(DESKTOP_SHELL_KEY, desktopShell)
  document.documentElement.classList.add('cinegen-desktop')
  document.documentElement.dataset.desktopShell = desktopShell
}

const app = createApp({
  name: 'RootProvider',
  render() {
    return h(
      ElConfigProvider,
      {
        message: {
          duration: 5000,
          showClose: true,
          offset: 28,
        },
      },
      () => h(App)
    )
  },
})
const pinia = createPinia()

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')
