const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Windows 会把系统“动画效果”设置映射到 prefers-reduced-motion。
// CineGen 桌面版的页面切换、弹窗与滑块都属于产品交互的一部分，因此在创建
// Chromium 进程前显式保持完整动效。网页版仍继续尊重浏览器/系统的无障碍设置。
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('force-prefers-no-reduced-motion');
}

// CineGen 使用全新的稳定数据目录。不要迁移 LocalMiniDrama 的测试数据或配置。
// CINEGEN_USER_DATA_DIR 仅用于发布冒烟测试和受控运维；普通启动仍使用系统标准目录。
const USERDATA_DIR = process.env.CINEGEN_USER_DATA_DIR
  ? path.resolve(process.env.CINEGEN_USER_DATA_DIR)
  : path.join(app.getPath('appData'), 'CineGen');
app.setPath('userData', USERDATA_DIR);

const MAIN_STARTUP_LOG = path.join(USERDATA_DIR, 'main-startup.log');
function writeMainLog(msg) {
  const line = `${new Date().toISOString()} ${msg}\n`;
  try {
    if (!fs.existsSync(USERDATA_DIR)) fs.mkdirSync(USERDATA_DIR, { recursive: true });
    fs.appendFileSync(MAIN_STARTUP_LOG, line);
  } catch (_) {}
}

process.on('uncaughtException', (err) => {
  writeMainLog(`uncaughtException: ${err && err.stack ? err.stack : err}`);
});
process.on('unhandledRejection', (reason) => {
  const text = reason instanceof Error ? reason.stack : String(reason);
  writeMainLog(`unhandledRejection: ${text}`);
});

writeMainLog(`main.js loaded packaged=${app.isPackaged} exec=${process.execPath}`);

const BACKEND_APP_PATH = path.join(__dirname, 'backend-app');
const BACKEND_NODE_PATH = path.join(__dirname, '..', 'backend-node');
const DEFAULT_PORT = 5679;

let serverInstance = null;
let mainWindow = null;
let statusTray = null;
let backendPort = null;
const WINDOW_CONTROL_CHANNEL = 'cinegen:window-control';
const WINDOW_STATE_CHANNEL = 'cinegen:window-state';
const APPEARANCE_GET_CHANNEL = 'cinegen:appearance-get';
const APPEARANCE_SET_CHANNEL = 'cinegen:appearance-set';
const APPEARANCE_FILE = path.join(USERDATA_DIR, 'appearance.json');

function getWindowState(win) {
  return {
    isMaximized: Boolean(win && !win.isDestroyed() && win.isMaximized()),
  };
}

// 只暴露固定动作，不允许渲染进程发送任意 Electron IPC。
ipcMain.handle(WINDOW_CONTROL_CHANNEL, (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return { isMaximized: false };

  switch (action) {
    case 'minimize':
      win.minimize();
      break;
    case 'toggle-maximize':
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
      break;
    case 'close':
      win.close();
      break;
    case 'get-state':
      break;
    default:
      throw new Error(`Unsupported window action: ${String(action)}`);
  }

  return getWindowState(win);
});

// 页面由本地后端端口提供；端口变化会形成不同的 localStorage origin。
// 因此外观偏好由主进程写入固定 userData，确保重启和端口回退后仍能恢复。
ipcMain.handle(APPEARANCE_GET_CHANNEL, () => {
  try {
    if (!fs.existsSync(APPEARANCE_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(APPEARANCE_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    writeMainLog(`appearance read failed: ${error.message}`);
    return null;
  }
});

ipcMain.handle(APPEARANCE_SET_CHANNEL, (_event, payload) => {
  try {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    const serialized = JSON.stringify(payload);
    if (serialized.length > 8192) return false;
    if (!fs.existsSync(USERDATA_DIR)) fs.mkdirSync(USERDATA_DIR, { recursive: true });
    fs.writeFileSync(APPEARANCE_FILE, `${serialized}\n`, 'utf8');
    return true;
  } catch (error) {
    writeMainLog(`appearance write failed: ${error.message}`);
    return false;
  }
});

/** 开发模式用 backend-node（改代码即生效）；打包后用 backend-app */
function getBackendModulePath() {
  if (app.isPackaged) return BACKEND_APP_PATH;
  // Electron 开发模式必须用 backend-app：require 会向上解析到 desktop/node_modules，
  // 其中 better-sqlite3 已由 postinstall 的 electron-builder install-app-deps 对准当前 Electron ABI。
  // 若直接用 backend-node，则会加载 backend-node/node_modules（多为本机 Node 编的 ABI，必炸）。
  if (process.versions.electron && fs.existsSync(path.join(BACKEND_APP_PATH, 'src', 'app.js'))) {
    return BACKEND_APP_PATH;
  }
  return fs.existsSync(BACKEND_NODE_PATH) ? BACKEND_NODE_PATH : BACKEND_APP_PATH;
}

function getBackendCwd() {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'backend');
  }
  return getBackendModulePath();
}

function ensureBackendCwd(backendCwd) {
  if (!fs.existsSync(backendCwd)) {
    fs.mkdirSync(backendCwd, { recursive: true });
  }
  const configsDir = path.join(backendCwd, 'configs');
  const dataDir = path.join(backendCwd, 'data');
  const logsDir = path.join(backendCwd, 'logs');
  const configPath = path.join(configsDir, 'config.yaml');

  if (!fs.existsSync(configsDir)) fs.mkdirSync(configsDir, { recursive: true });
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

  // 首次安装时，从打包内置的 config.yaml 复制到用户数据目录
  const bundledConfig = path.join(getBackendModulePath(), 'configs', 'config.yaml');
  if (!fs.existsSync(configPath) && fs.existsSync(bundledConfig)) {
    fs.copyFileSync(bundledConfig, configPath);
  }

  // 每次启动时，将内置 config.yaml 中的 vendor_lock 节强制同步到用户 config.yaml，
  // 确保打包时配置的锁定策略对所有用户生效，不受首次安装后遗留旧配置影响。
  if (fs.existsSync(bundledConfig) && fs.existsSync(configPath)) {
    try {
      const yaml = require('js-yaml');
      const userCfg = yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
      const bundledCfg = yaml.load(fs.readFileSync(bundledConfig, 'utf8')) || {};
      if (bundledCfg.vendor_lock !== undefined) {
        userCfg.vendor_lock = bundledCfg.vendor_lock;
        fs.writeFileSync(configPath, yaml.dump(userCfg, { lineWidth: -1 }), 'utf8');
      }
    } catch (e) {
      console.warn('[config] Failed to sync vendor_lock from bundled config:', e.message);
    }
  }
}

/**
 * 首次启动时，将打包内置的 ffmpeg 自动复制到 userData/backend/tools/ffmpeg/。
 * 来源：process.resourcesPath/ffmpeg/（由 electron-builder extraResources 写入）。
 * 已存在则跳过，不会重复覆盖，也不影响用户手动替换版本。
 */
function ensureFfmpeg(backendCwd) {
  if (!app.isPackaged) return;
  const isWin = process.platform === 'win32';
  const ffmpegName = isWin ? 'ffmpeg.exe' : 'ffmpeg';
  const ffprobeName = isWin ? 'ffprobe.exe' : 'ffprobe';

  const destDir = path.join(backendCwd, 'tools', 'ffmpeg');
  const destFfmpeg = path.join(destDir, ffmpegName);

  // 已存在则跳过（支持用户手动替换）
  if (fs.existsSync(destFfmpeg)) {
    console.log('[ffmpeg] Already exists at', destFfmpeg);
    return;
  }

  const srcDir = path.join(process.resourcesPath, 'ffmpeg');
  const srcFfmpeg = path.join(srcDir, ffmpegName);
  if (!fs.existsSync(srcFfmpeg)) {
    console.warn(
      '[ffmpeg] Bundled ffmpeg not found, skipping auto-extract. Expected:',
      srcFfmpeg,
      '(打包前请将 ffmpeg.exe 放入 backend-node/tools/ffmpeg，并确保 package.json 的 extraResources 包含该目录)'
    );
    return;
  }

  try {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcFfmpeg, destFfmpeg);
    if (!isWin) fs.chmodSync(destFfmpeg, 0o755);

    const srcFfprobe = path.join(srcDir, ffprobeName);
    if (fs.existsSync(srcFfprobe)) {
      const destFfprobe = path.join(destDir, ffprobeName);
      fs.copyFileSync(srcFfprobe, destFfprobe);
      if (!isWin) fs.chmodSync(destFfprobe, 0o755);
    }
    console.log('[ffmpeg] Auto-extracted to', destDir);
  } catch (e) {
    console.warn('[ffmpeg] Auto-extract failed:', e.message);
  }
}

function getWebDistPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'frontweb', 'dist');
  }
  return path.join(__dirname, '..', 'frontweb', 'dist');
}

/**
 * 探测端口是否空闲：优先使用 preferredPort，被占用时让 OS 分配一个随机空闲端口。
 * 返回最终可用的端口号。
 */
function findFreePort(preferredPort) {
  const net = require('net');
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => {
      // 首选端口被占，让 OS 随机分配
      const fallback = net.createServer();
      fallback.listen(0, '127.0.0.1', () => {
        const port = fallback.address().port;
        fallback.close(() => resolve(port));
      });
    });
    probe.listen(preferredPort, '127.0.0.1', () => {
      probe.close(() => resolve(preferredPort));
    });
  });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (process.platform === 'darwin') app.dock.show();
}

function createStatusTray(port) {
  if (process.platform !== 'darwin' || statusTray) return;

  const iconPath = path.join(__dirname, 'assets', 'cinegen-trayTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    writeMainLog(`status tray icon missing or invalid: ${iconPath}`);
    return;
  }
  icon.setTemplateImage(true);

  statusTray = new Tray(icon);
  statusTray.setToolTip('CineGen 正在运行');
  statusTray.setContextMenu(Menu.buildFromTemplate([
    {
      label: '显示 CineGen',
      click: showMainWindow,
    },
    {
      label: `运行中 · 本地服务 127.0.0.1:${port}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '完全退出 CineGen',
      click: () => app.quit(),
    },
  ]));
  statusTray.on('click', showMainWindow);
  writeMainLog(`status tray ready port=${port}`);
}

function createWindow(port) {
  Menu.setApplicationMenu(null);
  const isMac = process.platform === 'darwin';
  const isWindows = process.platform === 'win32';
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    // macOS 保留原生交通灯，但让网页内容延伸到窗口顶部，和应用导航栏融为一体。
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset',
          trafficLightPosition: { x: 18, y: 26 },
        }
      : {}),
    // Windows 使用网页导航栏作为唯一标题栏；窗口仍保留系统缩放与边缘拖拽能力。
    ...(isWindows ? { frame: false, autoHideMenuBar: true } : {}),
    backgroundColor: '#171717',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });
  mainWindow = win;

  const publishWindowState = () => {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send(WINDOW_STATE_CHANNEL, getWindowState(win));
    }
  };
  win.on('maximize', publishWindowState);
  win.on('unmaximize', publishWindowState);
  win.on('restore', publishWindowState);
  win.webContents.on('did-finish-load', publishWindowState);
  win.once('ready-to-show', () => {
    win.show();
    writeMainLog('window ready-to-show');
  });
  // 若页面长期不触发 ready-to-show，避免用户误以为“点了没反应”
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show();
      writeMainLog('window shown (fallback timeout, check page load)');
    }
  }, 8000);
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    writeMainLog(`did-fail-load code=${code} desc=${desc} url=${url}`);
  });
  const rendererUrl = new URL(`http://127.0.0.1:${port}`);
  rendererUrl.searchParams.set('desktop', isMac ? 'mac' : isWindows ? 'windows' : 'electron');
  writeMainLog(`createWindow loadURL ${rendererUrl.toString()}`);
  win.loadURL(rendererUrl.toString());
  win.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
  if (process.env.LOCALMINIDRAMA_DEVTOOLS === '1') {
    win.webContents.openDevTools();
  }
}

/** 后端始终在主进程内运行（打包用子进程会重复启动 exe 导致大量进程，故取消） */
async function startBackend() {
  const backendCwd = getBackendCwd();
  ensureBackendCwd(backendCwd);
  ensureFfmpeg(backendCwd);
  process.env.WEB_DIST_PATH = getWebDistPath();
  process.env.CINEGEN_APP_VERSION = app.getVersion();
  if (app.isPackaged) {
    process.env.LOG_FILE = path.join(backendCwd, 'logs', 'app.log');
    process.env.EXAMPLE_DRAMA_PATH = path.join(process.resourcesPath, 'example_drama');
  } else {
    process.env.EXAMPLE_DRAMA_PATH = path.join(__dirname, '..', 'example_drama');
  }
  process.chdir(backendCwd);

  const backendModulePath = getBackendModulePath();
  try {
    require(path.join(backendModulePath, 'src', 'db', 'migrate.js'));
  } catch (err) {
    console.warn('Migration warning:', err.message);
  }

  const { createApp } = require(path.join(backendModulePath, 'src', 'app.js'));
  const { createServer } = require('http');
  const { app: expressApp, config } = createApp();
  const preferredPort = config.server?.port || DEFAULT_PORT;

  // 自动探测空闲端口：优先默认端口，被占时由 OS 分配，支持多实例同时运行
  const port = await findFreePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} in use, using ${port}`);
  }

  return new Promise((resolve, reject) => {
    const server = createServer(expressApp);
    serverInstance = server;
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      console.log('Backend listening on', port);
      resolve(port);
    });
  });
}

app.whenReady().then(async () => {
  writeMainLog('app.whenReady');
  let port;
  try {
    port = await startBackend();
    writeMainLog(`startBackend ok port=${port}`);
  } catch (err) {
    const stack = err && err.stack ? err.stack : String(err);
    writeMainLog(`Failed to start backend\n${stack}`);
    console.error('Failed to start backend', err);
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'CineGen 启动失败',
      `后端服务未能启动，请查看日志：\n${MAIN_STARTUP_LOG}\n\n${stack}`
    );
    app.quit();
    return;
  }
  // startBackend 的 Promise 在 listen 回调中 resolve，服务器此时已就绪，直接建窗口
  backendPort = port;
  createWindow(port);
  createStatusTray(port);
});

app.on('activate', showMainWindow);

app.on('before-quit', () => {
  if (statusTray) {
    statusTray.destroy();
    statusTray = null;
  }
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
  backendPort = null;
});
