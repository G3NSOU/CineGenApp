# CineGen Web 1.4.25：Agent 部署与维护指令

本文件面向自动化 Agent。目标是把本包部署为本机单用户 Web 应用，默认地址 `http://127.0.0.1:5679/`。不要要求用户手工编辑数据库，不要把服务暴露到公网。

## 不变量

- Node.js：22.x，64 位。
- 进程工作目录：`backend-node`。
- 前端生产文件：`frontweb/dist`，由同一个 Express 进程提供。
- 数据目录：`backend-node/data`。
- 配置模板：`backend-node/configs/config.yaml`，不包含凭据。
- API Key：仅由 UI 写入 `backend-node/data/drama_generator.db`。
- 健康检查：`GET http://127.0.0.1:5679/health`。
- 不允许复制其他安装中的 `data`、`.runtime`、日志或 `.env` 到新安装。

## 一键部署

### macOS / Linux

```bash
cd /absolute/path/to/CineGen-Web-<版本号>
chmod +x cinegen.sh
./cinegen.sh install
./cinegen.sh start
curl -fsS http://127.0.0.1:5679/health
```

### Windows PowerShell

```powershell
Set-Location 'C:\absolute\path\to\CineGen-Web-<版本号>'
Set-ExecutionPolicy -Scope Process Bypass
.\cinegen.ps1 install
.\cinegen.ps1 start
Invoke-RestMethod http://127.0.0.1:5679/health
```

成功标准：健康检查返回 `status: ok`，根路径 HTTP 200，`backend-node/data/drama_generator.db` 已创建。

## 依赖检查

```text
node --version        必须为 v22.x
npm --version         必须可用
ffmpeg -version       完整流水线需要
ffprobe -version      完整流水线需要
```

若 `better-sqlite3` 安装需要源码编译：

- macOS：安装 Xcode Command Line Tools。
- Windows：安装 Visual Studio 2022 Build Tools 的“使用 C++ 的桌面开发”和 Python 3。
- Linux：安装 Python 3、make、g++。

## 文件职责

```text
backend-node/src/          Express API 与任务实现
backend-node/migrations/   SQLite 迁移，启动时自动执行
backend-node/configs/      无凭据运行配置
backend-node/data/         唯一持久化数据，升级时必须保留
frontweb/src/              Vue 源码
frontweb/public/           品牌与风格静态资源
frontweb/dist/             已验证的生产构建
.runtime/                  PID 与运行日志，可删除，不可作为数据备份
```

## 修改后的验证流程

```bash
cd backend-node
npm ci
node --test

cd ../frontweb
npm ci
node --test
npm run build

cd ..
./cinegen.sh restart
curl -fsS http://127.0.0.1:5679/health
```

Windows 使用等价 PowerShell 命令，并用 `.\cinegen.ps1 restart`。

## 升级流程

1. 停止旧进程。
2. 复制旧版 `backend-node/data` 到独立备份目录。
3. 解压新版到新目录。
4. 把旧版 `backend-node/data` 复制到新版；不要复制 `node_modules`、`.runtime` 或旧 `dist`。
5. 执行 `install`、`start`、健康检查。
6. 检查项目数、素材数和 AI 配置名称；不要在日志中打印 API Key。
7. 确认无误后再归档旧目录。

## 故障处理

- 端口冲突：设置 `PORT` 后启动，或停止占用端口的旧实例。
- 数据库锁定：确认只有一个 CineGen 后端进程，停止后再处理 WAL 文件；不要在运行中复制单个 DB 文件。
- 前端旧缓存：重新构建 `frontweb/dist`，重启后端，再强制刷新浏览器。
- 原生模块 ABI 错误：删除对应目录的 `node_modules`，使用 Node 22 执行 `npm ci`，不要从另一操作系统复制 `node_modules`。
- FFmpeg 缺少 `libx264`：换用包含该编码器的构建，并设置 `FFMPEG_PATH`、`FFPROBE_PATH`。

## 安全审计

分发前必须确认以下路径不存在：

```text
backend-node/data/*.db
backend-node/data/storage/*
.runtime/*
*.log
.env*
example_drama/*
```

凭据检测只报告文件名和命中数量，不得输出值。服务必须保持 `server.host: 127.0.0.1`，除非用户明确要求并同时提供认证与网络隔离方案。
