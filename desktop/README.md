# CineGen Desktop

Electron 桌面外壳，负责启动本地后端、展示 Vue 生产前端、维护托盘状态，并使用系统用户数据目录保存数据库和素材。

```bash
npm ci
npm start
```

发行构建：

```bash
npm run dist:mac   # macOS arm64
npm run dist:win   # Windows x64，必须在 Windows 本机执行
```

构建脚本会准备平台对应的 FFmpeg/FFprobe，并运行包内数据库、日志和凭据审计。预编译安装包不提交到本仓库。
