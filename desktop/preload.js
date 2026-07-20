const { contextBridge, ipcRenderer } = require('electron');

const WINDOW_CONTROL_CHANNEL = 'cinegen:window-control';
const WINDOW_STATE_CHANNEL = 'cinegen:window-state';
const APPEARANCE_GET_CHANNEL = 'cinegen:appearance-get';
const APPEARANCE_SET_CHANNEL = 'cinegen:appearance-set';

const invokeWindowAction = (action) => ipcRenderer.invoke(WINDOW_CONTROL_CHANNEL, action);

contextBridge.exposeInMainWorld('cinegenWindow', Object.freeze({
  platform: process.platform,
  minimize: () => invokeWindowAction('minimize'),
  toggleMaximize: () => invokeWindowAction('toggle-maximize'),
  close: () => invokeWindowAction('close'),
  getState: () => invokeWindowAction('get-state'),
  onStateChange: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, state) => callback(state);
    ipcRenderer.on(WINDOW_STATE_CHANNEL, handler);
    return () => ipcRenderer.removeListener(WINDOW_STATE_CHANNEL, handler);
  },
}));

contextBridge.exposeInMainWorld('cinegenAppearance', Object.freeze({
  load: () => ipcRenderer.invoke(APPEARANCE_GET_CHANNEL),
  save: (appearance) => ipcRenderer.invoke(APPEARANCE_SET_CHANNEL, appearance),
}));
