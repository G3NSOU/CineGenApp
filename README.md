# CineGen

<div align="center">
  <img src="frontweb/public/branding/cinegen-logo.png" alt="CineGen" width="320">

  **本地优先的 AI 影像创作工作台**

  [![Version](https://img.shields.io/badge/version-1.4.25-6f7782?style=flat-square)](CHANGELOG.md)
  [![License](https://img.shields.io/badge/license-MIT-6f7782?style=flat-square)](LICENSE)
  [![Node](https://img.shields.io/badge/Node.js-22.x-6f7782?style=flat-square)](https://nodejs.org/)
</div>

CineGen 是基于 [xuanyustudio/LocalMiniDrama](https://github.com/xuanyustudio/LocalMiniDrama) 深度二次开发的开源项目。它保留剧集流水线，同时加入面向 Seedance 2.0 的自由创作工作台、统一素材库、素材版本管理、TOS 同步和桌面端支持。

> 本仓库只发布可本地部署的源码与构建工具，不提交用户数据库、项目、素材、API Key、日志或预编译 Electron 安装包。

## 主要能力

- **两种工作模式**：剧集模式用于剧本到成片的完整流程；自由创作用于高自由度图生视频、全能参考和首尾帧生成。
- **统一素材库**：角色、场景、道具、音频四类资产跨项目复用；支持角色声音绑定、素材多版本切换和批量导入。
- **Seedance 2.0 全能参考**：提示词内使用 `@` 插入稳定编号的图片引用，支持角色图片与绑定声线关系、音频统计和任务生命周期管理。
- **本地与 TOS 协同**：素材默认本地管理；配置 TOS 后可同步素材并保存限时 URL，未配置时兼容第三方图床。
- **本地优先**：SQLite、上传素材和生成结果默认存放在本机，不提供公共云端服务。
- **桌面外壳**：Electron 源码支持 macOS arm64 与 Windows x64 构建，内置 FFmpeg/FFprobe 的构建流程。
- **统一视觉系统**：Liquid Glass 与低资源简约外观，Silk/Side Rays 背景和桌面级页面动效。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3、Vite、Element Plus、Pinia、Vue Flow、OGL/WebGL |
| 后端 | Node.js、Express、SQLite、better-sqlite3 |
| 桌面端 | Electron、electron-builder |
| 媒体处理 | FFmpeg、ffprobe |

## 快速开始：网页版

### 环境

- Node.js 22.x（推荐使用当前 LTS）
- npm 10+
- FFmpeg 与 ffprobe：剧集合成、抽帧、字幕和音频处理需要

### 安装与启动

```bash
git clone https://github.com/G3NSOU/CineGenApp.git
cd CineGenApp

cd backend-node
npm ci
cd ../frontweb
npm ci
npm run build
cd ../backend-node
npm start
```

浏览器打开 <http://127.0.0.1:5679/>。

也可以使用 `release-assets/web/` 中的 macOS/Linux Shell 或 Windows PowerShell 管理脚本。详细说明见：

- [人类用户本地部署指南](release-assets/web/README-人类用户.md)
- [Agent 部署与维护指令](release-assets/web/README-Agent部署.md)

## 开发

前端开发服务器：

```bash
cd frontweb
npm ci
npm run dev
```

后端开发服务器：

```bash
cd backend-node
npm ci
npm run dev
```

测试与生产构建：

```bash
cd backend-node && node --test test/*.test.js
cd ../frontweb && node --test test/*.test.js && npm run build
```

## 数据与隐私

运行后创建的所有用户数据位于 `backend-node/data/`，其中可能包含项目、素材和 AI 服务凭据。该目录已被 Git 忽略，不应提交、打包到源码仓库或发送给他人。

CineGen 会在用户主动生成内容、测试连接或同步素材时访问其配置的第三方 AI、对象存储或图床服务。请阅读对应服务商的隐私政策并自行保管凭据。不要把本地端口直接暴露到公网。

## 桌面端

桌面端源码位于 `desktop/`。macOS 和 Windows 的构建脚本会复制纯净后端、构建前端并准备对应平台的 FFmpeg/FFprobe。预编译 DMG/EXE 不在本仓库发布。

- macOS arm64：`cd desktop && npm ci && npm run dist:mac`
- Windows x64：使用 `release-assets/windows/README-Windows-Agent.md` 和 `BUILD-WINDOWS.ps1`

## 上游与许可证

CineGen 是 LocalMiniDrama 的 Fork。原项目版权和 MIT 许可声明完整保留在 [LICENSE](LICENSE) 中；CineGen 的修改部分由 CineGen contributors 维护。第三方来源与说明见 [THIRD-PARTY-NOTICES](release-assets/THIRD-PARTY-NOTICES.md)。

如果希望把通用修复贡献回上游，可从本仓库创建分支并向 LocalMiniDrama 发起 Pull Request；CineGen 专属功能则在本仓库维护。

## 贡献与安全

- [贡献指南](CONTRIBUTING.md)
- [安全政策](SECURITY.md)
- [行为准则](CODE_OF_CONDUCT.md)
- [变更记录](CHANGELOG.md)

## 免责声明

本项目不提供任何 AI 服务额度，也不保证第三方模型、API、图床或对象存储持续可用。生成内容的合法性、版权、隐私和平台合规责任由使用者自行承担。
