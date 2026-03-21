const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script - exposes safe IPC methods to renderer process
 * All communication between frontend and Electron goes through here
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // Service management
  getServiceStatus: () => ipcRenderer.invoke('get-service-status'),
  restartService: (serviceName) => ipcRenderer.invoke('restart-service', serviceName),
  getLogs: (serviceName) => ipcRenderer.invoke('get-logs', serviceName),

  // System operations
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),

  // Status updates (for splash screen)
  onStatusUpdate: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('status-update', subscription);
    return () => ipcRenderer.removeListener('status-update', subscription);
  },

  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),
  getPaths: () => ipcRenderer.invoke('get-paths'),

  // Models folder access
  openModelsFolder: () => ipcRenderer.invoke('open-models-folder')
});
