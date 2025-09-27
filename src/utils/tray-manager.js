const { app, Tray, nativeImage, Menu } = require('electron');
const path = require('path');
const { getPortDescription } = require('../../port-mapping');

// Create tray icon using the provided PNG file
async function createTray() {
  try {
    const iconPath = path.join(__dirname, '../../assets/icon.png');
    console.log('Loading tray icon from:', iconPath);

    const image = nativeImage.createFromPath(iconPath);
    console.log('Loaded icon size:', image.getSize());

    // Check if the image loaded successfully
    if (image.getSize().width === 0 || image.getSize().height === 0) {
      console.log('PNG loading failed, creating fallback bitmap...');
      throw new Error('PNG icon failed to load');
    }

    // Resize to appropriate tray icon size (16x16 for standard, or keep original if smaller)
    let finalImage = image;
    const originalSize = image.getSize();

    // If the image is very large, resize it for better tray display
    if (originalSize.width > 64 || originalSize.height > 64) {
      console.log('Resizing large icon for tray display...');
      finalImage = image.resize({ width: 16, height: 16, quality: 'best' });
      console.log('Resized to:', finalImage.getSize());
    }

    // Set as template image for proper macOS integration
    finalImage.setTemplateImage(true);

    const tray = new Tray(finalImage);
    return tray;
  } catch (error) {
    console.error('Tray creation with PNG failed:', error);

    // Fallback: create a simple bitmap icon
    try {
      console.log('Creating fallback bitmap icon...');
      const iconSize = 16;
      const bitmap = Buffer.alloc(iconSize * iconSize * 4); // RGBA

      // Create a bright, solid orange circle - very visible
      for (let y = 0; y < iconSize; y++) {
        for (let x = 0; x < iconSize; x++) {
          const offset = (y * iconSize + x) * 4;
          const centerX = iconSize / 2, centerY = iconSize / 2;
          const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

          // Solid orange circle
          if (distance < 6) {
            bitmap[offset] = 255;     // R - bright red
            bitmap[offset + 1] = 165; // G - orange
            bitmap[offset + 2] = 0;   // B - no blue
            bitmap[offset + 3] = 255; // A - fully opaque
          } else {
            // Transparent background for template image
            bitmap[offset] = 0;       // R
            bitmap[offset + 1] = 0;   // G
            bitmap[offset + 2] = 0;   // B
            bitmap[offset + 3] = 0;   // A - fully transparent
          }
        }
      }

      const image = nativeImage.createFromBuffer(bitmap, { width: iconSize, height: iconSize });
      image.setTemplateImage(true);

      const tray = new Tray(image);
      tray.setToolTip('PortPilot - Using Fallback Icon');
      return tray;
    } catch (finalError) {
      console.error('All tray creation methods failed:', finalError);
      return null;
    }
  }
}

// Set the application icon (dock icon)
function setAppIcon() {
  try {
    const iconPath = path.join(__dirname, '../../assets/icon.png');
    const image = nativeImage.createFromPath(iconPath);

    if (image.getSize().width > 0 && image.getSize().height > 0) {
      if (app.dock && app.dock.setIcon) {
        app.dock.setIcon(image);
      }
    }
  } catch (error) {
    console.error('Failed to set app icon:', error);
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
  await addViewData(menuItems, currentView, getPortsData, getMemoryData, killProcess, tray);

  menuItems.push({ type: 'separator' });
  menuItems.push({
    label: 'Quit PortPilot',
    click: () => process.exit(0)
  });

  const contextMenu = Menu.buildFromTemplate(menuItems);
  tray.setContextMenu(contextMenu);
}

// Add data based on current view
async function addViewData(menuItems, currentView, getPortsData, getMemoryData, killProcess, tray) {
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
    label: view === 'ports' ? '💾 Show Memory Usage' : '🔌 Show Active Ports',
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
  await addViewData(menuItems, view, getPortsData, getMemoryData, killProcess, tray);

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
  setAppIcon,
  updateTrayMenu,
  updateTrayMenuForView
};
