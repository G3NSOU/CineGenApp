# CineGen 网页版本地使用指南

本包是 CineGen 1.4.25 的纯净本地部署版。首次启动时数据库为空，不包含制作者的项目、素材、日志或 AI API Key。

## 1. 适用环境

- macOS、Windows 10/11 x64，或常见 x64 Linux。
- Node.js 22 LTS（64 位）和随 Node 附带的 npm。
- 至少 4GB 可用内存；生成与保存视频时建议预留 20GB 以上磁盘空间。
- FFmpeg 和 ffprobe：自由创作只生成视频片段时可暂不安装；剧本合成、抽帧、字幕、音频混合和最终合成需要安装，并要求 FFmpeg 支持 `libx264`。

官方依赖入口：

- Node.js 22：https://nodejs.org/en/download/archive/v22
- FFmpeg：https://ffmpeg.org/download.html

## 2. 第一次安装

解压后进入 `CineGen-Web-<版本号>` 文件夹（将 `<版本号>` 替换为下载包中的实际版本）。

### macOS / Linux

```bash
chmod +x cinegen.sh
./cinegen.sh install
./cinegen.sh start
```

### Windows PowerShell

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\cinegen.ps1 install
.\cinegen.ps1 start
```

启动完成后打开：http://127.0.0.1:5679/

停止、查看状态和日志：

```bash
./cinegen.sh stop
./cinegen.sh status
./cinegen.sh logs
```

Windows 将命令中的 `./cinegen.sh` 换成 `.\cinegen.ps1`。

## 3. 配置 AI 服务

点击右上角“AI 配置”，按服务类型添加自己的接口地址、模型名和 API Key。Key 保存在本机 SQLite 数据库中，不会写入源码或配置模板。

建议：

1. 先配置文本、图片、视频中实际会使用的服务。
2. 使用“测试连接”确认接口可用。
3. 不要把 `backend-node/data` 目录发送给别人，因为其中包含项目数据和 API Key。
4. 不要把 5679 端口直接暴露到公网。本包默认只监听 `127.0.0.1`。

## 4. 数据、备份与迁移

所有用户数据位于：

```text
backend-node/data/
├── drama_generator.db   项目、素材、AI 配置
└── storage/             上传与生成的图片、音频、视频
```

备份步骤：

1. 停止 CineGen。
2. 完整复制 `backend-node/data` 文件夹。
3. 将备份保存在加密磁盘或可信位置。

恢复时停止 CineGen，用备份的 `data` 文件夹替换当前文件夹，再启动即可。

## 5. 更新与维护

更新前必须先备份 `backend-node/data`。将新版程序解压到新目录，然后只把旧版 `backend-node/data` 复制到新版相同位置。不要把旧的 `node_modules`、`frontweb/dist` 或配置模板覆盖到新版。

之后重新执行：

```bash
./cinegen.sh install
./cinegen.sh start
```

数据库迁移会在启动时自动执行。

如果修改了前端源码：

```bash
cd frontweb
npm ci
npm run build
```

如果修改了后端依赖：

```bash
cd backend-node
npm ci --omit=dev
```

## 6. 常见问题

### 5679 无法访问

- 运行 `cinegen.sh status` 或 `cinegen.ps1 status`。
- 查看 `.runtime/backend-error.log` 和 `.runtime/backend.log`。
- 确认没有其他程序占用 5679；可用环境变量 `PORT` 改端口。

### FFmpeg 不可用

在终端执行：

```text
ffmpeg -version
ffprobe -version
```

也可以通过环境变量 `FFMPEG_PATH` 和 `FFPROBE_PATH` 指向可执行文件。

### npm 安装失败

- 确认使用 Node.js 22 x64。
- 删除当前包里的 `node_modules` 后重新执行安装。
- `EAI_AGAIN`、`ECONNRESET`、`ETIMEDOUT` 通常是下载网络问题，换网络后重试。

## 7. 安全边界

CineGen 是本地单用户工具，目前没有登录鉴权。默认回环地址适合本机使用。如果需要局域网或公网访问，必须另行配置 HTTPS、身份认证、访问控制和备份策略。
