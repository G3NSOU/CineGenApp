#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend-node"
RUNTIME="$ROOT/.runtime"
PID_FILE="$RUNTIME/backend.pid"
OUT_LOG="$RUNTIME/backend.log"
ERR_LOG="$RUNTIME/backend-error.log"
PORT="${PORT:-5679}"

require_node() {
  command -v node >/dev/null 2>&1 || { echo "缺少 Node.js 22 LTS" >&2; exit 1; }
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [[ "$major" == "22" ]] || { echo "需要 Node.js 22.x，当前为 $(node --version)" >&2; exit 1; }
}

install_app() {
  require_node
  mkdir -p "$BACKEND/data/storage" "$RUNTIME"
  (cd "$BACKEND" && npm ci --omit=dev)
  if [[ ! -f "$ROOT/frontweb/dist/index.html" ]]; then
    (cd "$ROOT/frontweb" && npm ci && npm run build)
  fi
  echo "CineGen Web 依赖安装完成"
}

is_running() { [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; }

start_app() {
  require_node
  [[ -d "$BACKEND/node_modules" ]] || install_app
  if is_running; then echo "CineGen 已运行：PID $(cat "$PID_FILE") · http://127.0.0.1:$PORT"; return; fi
  mkdir -p "$RUNTIME" "$BACKEND/data/storage"
  (cd "$BACKEND" && PORT="$PORT" nohup node src/server.js >>"$OUT_LOG" 2>>"$ERR_LOG" & echo $! >"$PID_FILE")
  for _ in {1..40}; do
    if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
      echo "CineGen 已启动：http://127.0.0.1:$PORT"
      return
    fi
    sleep .5
  done
  echo "启动失败，请查看 $ERR_LOG" >&2
  exit 1
}

stop_app() {
  if ! is_running; then rm -f "$PID_FILE"; echo "CineGen 未运行"; return; fi
  local pid="$(cat "$PID_FILE")"
  kill "$pid"
  for _ in {1..20}; do kill -0 "$pid" 2>/dev/null || break; sleep .25; done
  rm -f "$PID_FILE"
  echo "CineGen 已停止"
}

case "${1:-start}" in
  install) install_app ;;
  start) start_app ;;
  stop) stop_app ;;
  restart) stop_app; start_app ;;
  status) if is_running; then echo "运行中：PID $(cat "$PID_FILE") · http://127.0.0.1:$PORT"; else echo "未运行"; exit 1; fi ;;
  logs) mkdir -p "$RUNTIME"; touch "$OUT_LOG" "$ERR_LOG"; tail -f "$OUT_LOG" "$ERR_LOG" ;;
  *) echo "用法：$0 {install|start|stop|restart|status|logs}" >&2; exit 2 ;;
esac
