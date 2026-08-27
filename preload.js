const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jutokaDesktop', {
  // App info
  getVersion: () => ipcRenderer.invoke('desktop:get-version'),
  getPlatform: () => ipcRenderer.invoke('desktop:get-platform'),
  getRenderCapabilities: () => ipcRenderer.invoke('desktop:get-render-capabilities'),

  // Rendering
  renderVideo: (job) => ipcRenderer.invoke('desktop:render-video', job),
  onRenderProgress: (callback) => ipcRenderer.on('render:progress', (e, data) => callback(data)),
  onRenderComplete: (callback) => ipcRenderer.on('render:complete', (e, data) => callback(data)),
  onRenderError: (callback) => ipcRenderer.on('render:error', (e, data) => callback(data)),

  // Render queue
  getQueue: () => ipcRenderer.invoke('desktop:get-queue'),
  addToQueue: (job) => ipcRenderer.invoke('desktop:add-to-queue', job),
  removeFromQueue: (jobId) => ipcRenderer.invoke('desktop:remove-from-queue', jobId),
  clearQueue: () => ipcRenderer.invoke('desktop:clear-queue'),

  // Settings
  getSettings: () => ipcRenderer.invoke('desktop:get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('desktop:set-settings', settings),

  // Auth
  setAuthToken: (token) => ipcRenderer.invoke('desktop:set-auth-token', token),
  getAuthToken: () => ipcRenderer.invoke('desktop:get-auth-token'),
  clearAuth: () => ipcRenderer.invoke('desktop:clear-auth'),

  // Navigation
  onNavigate: (callback) => ipcRenderer.on('navigate', (e, url) => callback(url)),
});
