const { app, ipcMain } = require('electron');
const { getPortsData, getMemoryData } = require('./utils/system-info');
const { killProcess, killPort, killPid } = require('./utils/process-manager');
const { createTray, updateTrayMenu } = require('./utils/tray-manager');

let tray;
let currentView = 'ports';

async function initializeApp() {
  try {
    // Hide dock icon if available (macOS menu-bar style)
    if (app.dock && typeof app.dock.hide === 'function') {
      app.dock.hide();
    }
    // Create tray icon
    tray = await createTray();
    if (!tray) {
      console.error('Failed to create tray icon');
      return;
    }
    tray.setToolTip('PortPilot - Port & Process Manager');
    // Initial menu update
    await updateTrayMenu(tray, currentView, getPortsData, getMemoryData, killProcess);
  } catch (error) {
    console.error('Failed to initialize PortPilot:', error);
  }
}

// IPC handlers for renderer process communication
ipcMain.handle('getPorts', async () => {
  return await getPortsData();
});

ipcMain.handle('killPort', async (e, port, force = true) => {
  return await killPort(port, force);
});

ipcMain.handle('killPid', async (e, { pid, force }) => {
  return await killPid({ pid, force });
});

ipcMain.handle('getTopMemory', async (e, limit = 15) => {
  const memoryData = await getMemoryData();
  return memoryData.processes.slice(0, limit);
});

app.whenReady().then(initializeApp);

app.on('window-all-closed', (e) => {
  e.preventDefault(); // Keep app running in tray
});

// Graceful shutdown
process.on('SIGINT', () => {
  if (tray && tray.destroy) {
    tray.destroy();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (tray && tray.destroy) {
    tray.destroy();
  }
  process.exit(0);
});

module.exports = {
  initializeApp,
  tray,
  currentView
};
