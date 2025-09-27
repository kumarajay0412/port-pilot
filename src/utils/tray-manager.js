const { Tray, nativeImage, Menu } = require('electron');
const path = require('path');
const { getPortDescription } = require('../../port-mapping');

// Create tray icon
async function createTray() {
  try {
    const iconSize = 16; // Standard size for tray icons
    const bitmap = Buffer.alloc(iconSize * iconSize * 4); // RGBA

    // Create a bright, solid orange circle - very visible
    for (let y = 0; y < iconSize; y++) {
      for (let x = 0; x < iconSize; x++) {
        const offset = (y * iconSize + x) * 4;
        const centerX = iconSize / 2, centerY = iconSize / 2;
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

        // Solid orange circle - make it bright and visible
        if (distance < 6) {
          bitmap[offset] = 255;     // R - bright red
          bitmap[offset + 1] = 165; // G - orange
          bitmap[offset + 2] = 0;   // B - no blue
          bitmap[offset + 3] = 255; // A - fully opaque
        } else {
          // Make background white and opaque
          bitmap[offset] = 255;     // R - white background
          bitmap[offset + 1] = 255; // G
          bitmap[offset + 2] = 255; // B
          bitmap[offset + 3] = 255; // A - fully opaque
        }
      }
    }

    const image = nativeImage.createFromBuffer(bitmap, { width: iconSize, height: iconSize });
    // Set as template image for proper macOS integration
    image.setTemplateImage(true);

    const tray = new Tray(image);
    return tray;
  } catch (error) {
    console.error('Tray creation failed:', error);

    // Last resort: empty tray
    try {
      const emptyImage = nativeImage.createEmpty();
      const tray = new Tray(emptyImage);
      tray.setToolTip('PortPilot - Fallback Mode');
      return tray;
    } catch (finalError) {
      console.error('All tray creation methods failed:', finalError);
      return null;
    }
  }
}

// Update tray menu with current data
async function updateTrayMenu(tray, currentView, getPortsData, getMemoryData, killProcess) {
  if (!tray) return;

  const menuItems = [];

  // Add view toggle
  menuItems.push({
    label: currentView === 'ports' ? '💾 Show Memory Usage' : '🔌 Show Active Ports',
    click: () => {
      // Switch views and update menu
      const newView = currentView === 'ports' ? 'memory' : 'ports';
      setTimeout(async () => {
        await updateTrayMenuForView(tray, newView, getPortsData, getMemoryData, killProcess);
        // Show the updated menu
        if (tray) {
          tray.popUpContextMenu();
        }
      }, 50);
    }
  });

  menuItems.push({ type: 'separator' });

  // Add refresh button
  menuItems.push({
    label: '🔄 Refresh',
    click: () => {
      setTimeout(async () => {
        await updateTrayMenuForView(tray, currentView, getPortsData, getMemoryData, killProcess);
        // Show the updated menu
        if (tray) {
          tray.popUpContextMenu();
        }
      }, 50);
    }
  });

  menuItems.push({ type: 'separator' });

  // Add data based on current view
  await addViewData(menuItems, currentView, getPortsData, getMemoryData, killProcess);

  menuItems.push({ type: 'separator' });
  menuItems.push({
    label: 'Quit PortPilot',
    click: () => process.exit(0)
  });

  const contextMenu = Menu.buildFromTemplate(menuItems);
  tray.setContextMenu(contextMenu);
}

// Add data based on current view
async function addViewData(menuItems, currentView, getPortsData, getMemoryData, killProcess) {
  try {
    if (currentView === 'ports') {
      const ports = await getPortsData();
      if (ports.length === 0) {
        menuItems.push({ label: 'No active ports found', enabled: false });
      } else {
        menuItems.push({ label: `Active Ports (${ports.length}):`, enabled: false });
        menuItems.push({ type: 'separator' });

        for (const port of ports.slice(0, 15)) { // Limit to 15 items
          const friendlyName = getPortDescription(port.port, port.name);
          menuItems.push({
            label: `Port ${port.port} - ${friendlyName} (PID: ${port.pid})`,
            submenu: [
              {
                label: '🚫 Kill Process',
                click: async () => {
                  const success = await killProcess(port.pid, true);
                  if (success) {
                    setTimeout(() => updateTrayMenu(tray, currentView, getPortsData, getMemoryData, killProcess), 1000);
                  }
                }
              }
            ]
          });
        }
      }
    } else {
      const memoryData = await getMemoryData();
      if (memoryData.processes.length === 0) {
        menuItems.push({ label: 'No memory data available', enabled: false });
      } else {
        // Show total memory usage first
        const usedGB = Math.round(memoryData.usedMemoryGB * 10) / 10;
        const totalGB = memoryData.totalMemoryGB;
        const memoryPercent = totalGB > 0 ? Math.round((usedGB / totalGB) * 100) : 0;

        menuItems.push({
          label: `💾 Memory: ${usedGB}GB / ${totalGB}GB (${memoryPercent}%)`,
          enabled: false
        });
        menuItems.push({ type: 'separator' });
        menuItems.push({ label: `Top Memory Users (${memoryData.processes.length}):`, enabled: false });
        menuItems.push({ type: 'separator' });

        for (const proc of memoryData.processes.slice(0, 15)) {
          const memoryMB = Math.round(proc.rssKB / 1024);
          menuItems.push({
            label: `${proc.name} (${memoryMB}MB, ${proc.percent}%)`,
            submenu: [
              {
                label: '🚫 Kill Process',
                click: async () => {
                  const success = await killProcess(proc.pid, true);
                  if (success) {
                    setTimeout(() => updateTrayMenu(tray, currentView, getPortsData, getMemoryData, killProcess), 1000);
                  }
                }
              }
            ]
          });
        }
      }
    }
  } catch (error) {
    console.error('Error building menu:', error);
    menuItems.push({ label: 'Error loading data', enabled: false });
  }
}

// Helper function to update tray menu for a specific view
async function updateTrayMenuForView(tray, view, getPortsData, getMemoryData, killProcess) {
  if (!tray) return;

  const menuItems = [];

  // Add view toggle
  menuItems.push({
    label: view === 'ports' ? '📊 Show Memory Usage' : '🔌 Show Active Ports',
    click: () => {
      const newView = view === 'ports' ? 'memory' : 'ports';
      setTimeout(async () => {
        await updateTrayMenuForView(tray, newView, getPortsData, getMemoryData, killProcess);
        if (tray) {
          tray.popUpContextMenu();
        }
      }, 50);
    }
  });

  menuItems.push({ type: 'separator' });

  // Add refresh button
  menuItems.push({
    label: '🔄 Refresh',
    click: () => {
      setTimeout(async () => {
        await updateTrayMenuForView(tray, view, getPortsData, getMemoryData, killProcess);
        if (tray) {
          tray.popUpContextMenu();
        }
      }, 50);
    }
  });

  menuItems.push({ type: 'separator' });

  // Add data based on view
  await addViewData(menuItems, view, getPortsData, getMemoryData, killProcess);

  menuItems.push({ type: 'separator' });
  menuItems.push({
    label: 'Quit PortPilot',
    click: () => process.exit(0)
  });

  const contextMenu = Menu.buildFromTemplate(menuItems);
  tray.setContextMenu(contextMenu);
}

module.exports = {
  createTray,
  updateTrayMenu,
  updateTrayMenuForView
};
