// CineGen 采用单一深色视觉系统。清除旧版本留下的主题偏好，避免缓存恢复浅色 UI。
localStorage.removeItem('lmd-theme')
localStorage.removeItem('cgp-theme-version')
document.documentElement.classList.remove('light')
document.documentElement.classList.add('dark')
