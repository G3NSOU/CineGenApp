#!/bin/bash
# CineGen macOS arm64 打包脚本
# 用法：在 desktop/ 目录下执行 bash dist-mac.sh
# 或先授权：chmod +x dist-mac.sh && ./dist-mac.sh

set -e

# 使用国内镜像加速 Electron 下载
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://cdn.npmmirror.com/binaries/electron-builder-binaries/"

# 禁用 macOS 代码签名（无证书时跳过签名流程）
export CSC_IDENTITY_AUTO_DISCOVERY=false

# 切换到 desktop 目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "========== CineGen macOS arm64 clean build =========="
echo ""

# 生成图标、准备平台 FFmpeg、复制干净后端、编译前端并打包。
npm run icons:mac
npm run prepare:ffmpeg:mac
npm run prepare-backend
npm run build:front
npm run copy-front
npx electron-builder --mac --arm64 --config electron-builder-mac.json

echo ""
echo "========== 全部构建完成 =========="
echo "输出目录：release/"
echo "  CineGen-x.x.x-mac-arm64.dmg"
echo ""
