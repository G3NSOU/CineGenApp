# CineGen Windows x64 构建包：Agent 执行文档

目标：在 Windows 10/11 x64 本机生成 CineGen 1.4.25 的 NSIS 安装程序。此包用于替代旧构建工作区；不要把新旧源码或 `node_modules` 混合覆盖，不要导入任何旧项目或 API Key。

## 最终输出

```text
desktop\release\CineGen-1.4.25-windows-x64-setup.exe
```

安装后数据目录为：

```text
%APPDATA%\CineGen\backend\
```

安装包本身不得包含该目录、数据库、日志、示例项目或 `.env`。

## 1. 主机要求

- Windows 10/11 x64，PowerShell 5.1 或更新版本。
- Node.js 22.x LTS x64；不要使用 Node 20（已结束支持），也不要在本次构建中自行升级 Electron。
- npm 10.x。
- 至少 12GB 可用磁盘和 8GB 内存。
- 可访问 npm、Electron 和静态二进制下载源。

如果 `npm ci` 的原生模块没有可用预编译包，还需要：

- Visual Studio 2022 Build Tools，勾选“使用 C++ 的桌面开发”。
- Python 3 x64。

官方参考：

- Node 22：https://nodejs.org/en/download/archive/v22
- Electron 分发：https://www.electronjs.org/docs/latest/tutorial/application-distribution
- electron-builder Windows：https://www.electron.build/docs/win/
- electron-builder NSIS：https://www.electron.build/docs/nsis/
- FFmpeg：https://ffmpeg.org/download.html

## 2. 不允许做的事

- 不要复制 macOS 的 `node_modules`、`vendor/darwin-arm64` 或 `.app`。
- 不要把本机其他 CineGen 安装的 `%APPDATA%\CineGen` 放入构建目录。
- 不要加入 `backend-node\data`、数据库、日志、示例项目或用户配置。
- 不要在日志、Issue 或回复中打印 API Key。
- 不要关闭发布审计脚本来“让构建通过”。
- 不要生成 x86、ARM64 或便携版；本轮目标只有 Windows x64 NSIS。
- 不要恢复或显示 Windows Electron 中的“外观”入口；该功能当前仅供网页与 macOS 使用。源码已通过 `data-desktop-shell="windows"` 自动隐藏入口。

## 3. 构建

这是完整 BuildKit，不是在 1.4.4 源码上叠加的 patch。请把压缩包解压到全新目录，不要复制旧工作区的 `frontweb`、`backend-node`、`desktop` 或 `node_modules` 进来。

已安装旧版的用户数据位于 `%APPDATA%\CineGen`，不属于构建输入。构建和纯净审计期间不要读取或复制该目录；最终安装 1.4.25 时可由相同 App ID 继续使用原用户数据，正式覆盖前建议用户自行备份。

在包根目录打开 PowerShell：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\BUILD-WINDOWS.ps1
```

脚本会执行：

1. 检查 Windows x64 与 Node 22。
2. 按锁文件安装后端、前端和桌面依赖。
3. 运行后端测试与前端测试。
4. 构建 Vue 生产文件。
5. 生成 Windows ICO。
6. 下载并验证当前 Windows x64 的 ffmpeg、ffprobe，确认 ffmpeg 包含 `libx264`。
7. 重建 Electron 原生依赖。
8. 生成 NSIS 安装程序。
9. 审计 `app.asar` 和资源目录，拒绝数据库、日志、示例项目、`.env` 和疑似凭据。
10. 用独立临时数据目录启动 `win-unpacked` App，自动确认项目、素材、AI 配置和凭据计数全为 0。
11. 输出 SHA-256。

## 4. 构建成功标准

PowerShell 必须出现：

```text
Release audit passed
Build complete
SHA-256: ...
```

随后确认：

```powershell
Get-ChildItem .\desktop\release\CineGen-*-windows-x64-setup.exe
Get-FileHash .\desktop\release\CineGen-1.4.25-windows-x64-setup.exe -Algorithm SHA256
```

## 5. 干净首次启动测试

一键构建脚本已自动执行本测试。如需手工重测，不要使用真实 `%APPDATA%\CineGen`，而是用专用环境变量启动 unpacked 版本：

```powershell
$smoke = Join-Path $PWD '.smoke-user-data'
Remove-Item $smoke -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $smoke | Out-Null
$oldCineGenUserData = $env:CINEGEN_USER_DATA_DIR
$env:CINEGEN_USER_DATA_DIR = $smoke
$p = Start-Process '.\desktop\release\win-unpacked\CineGen.exe' -PassThru
for ($i = 0; $i -lt 40 -and -not (Test-Path "$smoke\backend\data\drama_generator.db"); $i++) { Start-Sleep -Milliseconds 500 }
node .\AUDIT-CLEAN-DATABASE.js "$smoke\backend\data\drama_generator.db"
Stop-Process -Id $p.Id
$env:CINEGEN_USER_DATA_DIR = $oldCineGenUserData
```

其中 `AUDIT-CLEAN-DATABASE.js` 会只读确认临时数据库中的以下表为 0：

```text
dramas, episodes, storyboards, characters, scenes, props,
character_libraries, scene_libraries, prop_libraries, audio_libraries,
ai_service_configs
```

完成后可删除 `.smoke-appdata`。不要将它交付给用户。

## 6. 常见失败

### better-sqlite3 或 sharp 构建失败

确认 Node 为 22.x x64。安装 Visual Studio 2022 Build Tools 的 C++ 桌面工作负载和 Python 3，删除三个工程中的 `node_modules`，重新执行 `BUILD-WINDOWS.ps1`。

### Electron 下载超时

先重试或更换网络。Electron 官方说明 `EAI_AGAIN`、`ECONNRESET`、`ETIMEDOUT` 通常属于网络问题。不要关闭校验和检查。

### FFmpeg 校验失败

不要跳过。确保 Windows 包同时含 `ffmpeg.exe`、`ffprobe.exe`，且 `ffmpeg -encoders` 包含 `libx264`。

### SmartScreen 提示

当前开源测试版本未签名，Windows 可能显示未知发布者。不要伪造签名。未来获得代码签名证书后，再配置 electron-builder 的签名环境变量重新发布。

## 7. 交付给上游 Agent/用户

只交付：

```text
CineGen-1.4.25-windows-x64-setup.exe
SHA256SUMS.txt
本次构建日志（必须先确认不含凭据）
```

不要交付 `win-unpacked`、`.smoke-appdata`、`node_modules` 或任何 `%APPDATA%\CineGen` 内容。
