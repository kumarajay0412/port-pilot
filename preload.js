const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('portpilot', {
  getPorts: () => ipcRenderer.invoke('getPorts'),
  killPort: (port, force = true) => ipcRenderer.invoke('killPort', port, force),
  getTopMemory: (limit = 15) => ipcRenderer.invoke('getTopMemory', limit),
  killPid: (pid, force = false) => ipcRenderer.invoke('killPid', { pid, force })
});
