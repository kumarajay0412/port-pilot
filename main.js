const { app, BrowserWindow, Tray, nativeImage, screen, ipcMain } = require('electron');
const path = require('path');
const { execFile } = require('child_process');

let tray, win;
let currentView = 'ports'; // 'ports' or 'memory'

async function getPortsData() {
  try {
    const out = await sh('/usr/sbin/lsof', ['-nP', '-iTCP', '-sTCP:LISTEN']);
    const lines = out.split('\n').filter(Boolean);
    if (lines.length <= 1) return [];

    const rows = [];
    for (const line of lines.slice(1)) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 9) continue;
      const cmd = cols[0];
      const pid = parseInt(cols[1], 10);
      const nameCol = cols.slice(8).join(' ');
      const m = nameCol.match(/:(\d+)\s/);
      const port = m ? parseInt(m[1], 10) : null;
      if (pid && port) rows.push({ pid, port, name: cmd });
    }

    const seen = new Set();
    return rows
      .filter(r => {
        const key = `${r.pid}-${r.port}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.port - b.port);
  } catch (error) {
    console.error('Failed to get ports:', error);
    return [];
  }
}

async function getMemoryData() {
  try {
    const out = await sh('/bin/ps', ['-axo', 'pid,comm,rss,pmem']);
    const lines = out.split('\n').filter(Boolean);
    const procs = [];
    for (const [i, line] of lines.entries()) {
      if (i === 0) continue; // header
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const pid = parseInt(parts[0], 10);
      const pmem = parseFloat(parts[parts.length - 1]) || 0;
      const rssKB = parseInt(parts[parts.length - 2], 10) || 0;
      const name = parts.slice(1, parts.length - 2).join(' ');
      if (pid) procs.push({ pid, name, rssKB, percent: pmem });
    }
    procs.sort((a, b) => b.rssKB - a.rssKB);
    return procs.slice(0, 10); // Top 10 memory users
  } catch (error) {
    console.error('Failed to get memory data:', error);
    return [];
  }
}

async function killProcess(pid, force = true) {
  try {
    const signal = force ? 'SIGKILL' : 'SIGTERM';
    console.log(`Killing PID ${pid} with ${signal}`);
    await sh('sudo', ['kill', `-${signal}`, pid.toString()]);
    console.log(`Successfully killed PID ${pid}`);
    return true;
  } catch (err) {
    console.log('sudo kill failed:', err.message);
    try {
      process.kill(parseInt(pid, 10), force ? 'SIGKILL' : 'SIGTERM');
      console.log(`Successfully killed PID ${pid} with regular kill`);
      return true;
    } catch (err2) {
      console.log('Regular kill also failed:', err2.message);
      return false;
    }
  }
}

async function updateTrayMenu() {
  if (!tray) return;

  const { Menu } = require('electron');
  const menuItems = [];

  // Add view toggle
  menuItems.push({
    label: currentView === 'ports' ? '📊 Show Memory Usage' : '🔌 Show Active Ports',
    click: () => {
      currentView = currentView === 'ports' ? 'memory' : 'ports';
      updateTrayMenu();
    }
  });

  menuItems.push({ type: 'separator' });

  // Add refresh button
  menuItems.push({
    label: '🔄 Refresh',
    click: () => updateTrayMenu()
  });

  menuItems.push({ type: 'separator' });

  try {
    if (currentView === 'ports') {
      const ports = await getPortsData();
      if (ports.length === 0) {
        menuItems.push({ label: 'No active ports found', enabled: false });
      } else {
        menuItems.push({ label: `Active Ports (${ports.length}):`, enabled: false });
        menuItems.push({ type: 'separator' });

        for (const port of ports.slice(0, 15)) { // Limit to 15 items
          menuItems.push({
            label: `Port ${port.port} - ${port.name} (PID: ${port.pid})`,
            submenu: [
              {
                label: '🚫 Kill Process',
                click: async () => {
                  const success = await killProcess(port.pid, true);
                  if (success) {
                    console.log(`Killed process on port ${port.port}`);
                    // Refresh menu after a short delay
                    setTimeout(() => updateTrayMenu(), 1000);
                  }
                }
              }
            ]
          });
        }
      }
    } else {
      const memoryData = await getMemoryData();
      if (memoryData.length === 0) {
        menuItems.push({ label: 'No memory data available', enabled: false });
      } else {
        menuItems.push({ label: `Top Memory Usage (${memoryData.length}):`, enabled: false });
        menuItems.push({ type: 'separator' });

        for (const proc of memoryData.slice(0, 15)) {
          const memoryMB = Math.round(proc.rssKB / 1024);
          menuItems.push({
            label: `${proc.name} (${memoryMB}MB, ${proc.percent}%)`,
            submenu: [
              {
                label: '🚫 Kill Process',
                click: async () => {
                  const success = await killProcess(proc.pid, true);
                  if (success) {
                    console.log(`Killed process ${proc.name}`);
                    setTimeout(() => updateTrayMenu(), 1000);
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

  menuItems.push({ type: 'separator' });
  menuItems.push({
    label: 'Show PortPilot Window',
    click: toggleWindow
  });
  menuItems.push({ type: 'separator' });
  menuItems.push({
    label: 'Quit PortPilot',
    click: () => app.quit()
  });

  const contextMenu = Menu.buildFromTemplate(menuItems);
  tray.setContextMenu(contextMenu);
}

function resolveAsset(name) {
  return path.join(__dirname, 'assets', name);
}

function createWindow() {
  win = new BrowserWindow({
    width: 440,
    height: 520,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    vibrancy: 'menu',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

async function createTray() {
  try {
    console.log('Creating white square with red dot tray icon...');

    // Create a 16x16 bitmap for white square with red dot
    const bitmap = Buffer.alloc(16 * 16 * 4); // RGBA

    // Draw white square background and red dot in center
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const offset = (y * 16 + x) * 4;

        // Check if this pixel is part of the red dot in center
        const distance = Math.sqrt((x - 8) ** 2 + (y - 8) ** 2);
        const isRedDot = distance < 4; // Slightly larger red dot with radius 4

        if (isRedDot) {
          // Bright red dot - use maximum red values
          bitmap[offset] = 255;     // R - maximum red
          bitmap[offset + 1] = 0;   // G - no green
          bitmap[offset + 2] = 0;   // B - no blue
          bitmap[offset + 3] = 255; // A - fully opaque
        } else {
          // White square background with slight transparency for better integration
          bitmap[offset] = 255;     // R - white
          bitmap[offset + 1] = 255; // G
          bitmap[offset + 2] = 255; // B
          bitmap[offset + 3] = 200; // A - slightly transparent white
        }
      }
    }

    const image = nativeImage.createFromBuffer(bitmap, { width: 16, height: 16 });
    console.log('Created white square with red dot image:', image.getSize());

    // Explicitly set template image to false to prevent macOS from changing colors
    image.setTemplateImage(false);

    tray = new Tray(image);
    tray.setToolTip('PortPilot - Port & Process Manager');
    tray.on('click', toggleWindow);
    console.log('Tray created with white square and red dot!');

    // Set initial context menu
    await updateTrayMenu();

    // Log position
    if (tray) {
      const bounds = tray.getBounds();
      console.log('Tray position:', bounds);
    }

  } catch (error) {
    console.error('Tray creation failed:', error);

    // Try a different approach - use a different color that won't be affected by macOS theming
    try {
      console.log('Trying orange dot instead...');
      const bitmap = Buffer.alloc(16 * 16 * 4); // RGBA

      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const offset = (y * 16 + x) * 4;
          const distance = Math.sqrt((x - 8) ** 2 + (y - 8) ** 2);
          const isDot = distance < 4;

          if (isDot) {
            // Orange dot - might be less affected by macOS theming
            bitmap[offset] = 255;     // R - red
            bitmap[offset + 1] = 165; // G - green
            bitmap[offset + 2] = 0;   // B - blue
            bitmap[offset + 3] = 255; // A - fully opaque
          } else {
            // White background
            bitmap[offset] = 255;     // R - white
            bitmap[offset + 1] = 255; // G
            bitmap[offset + 2] = 255; // B
            bitmap[offset + 3] = 200; // A - slightly transparent
          }
        }
      }

      const image = nativeImage.createFromBuffer(bitmap, { width: 16, height: 16 });
      image.setTemplateImage(false);

      tray = new Tray(image);
      tray.setToolTip('PortPilot - Port & Process Manager');
      tray.on('click', toggleWindow);
      console.log('Tray created with orange dot fallback');
    } catch (fallbackError) {
      console.error('Fallback failed:', fallbackError);

      // Last resort
      try {
        console.log('Trying empty tray...');
        const emptyImage = nativeImage.createEmpty();
        tray = new Tray(emptyImage);
        tray.setToolTip('PortPilot');
        tray.on('click', toggleWindow);
        console.log('Empty tray created');
      } catch (finalError) {
        console.error('All methods failed:', finalError);
      }
    }
  }
}

function toggleWindow() {
  if (win.isVisible()) {
    win.hide();
  } else {
    positionWindow();
    win.show();
    win.focus();
  }
}

function positionWindow() {
  const trayBounds = tray.getBounds();
  const winBounds = win.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (winBounds.width / 2));
  const y = Math.round(display.workArea.y); // pop from top
  win.setPosition(x, y, false);
}

app.dock?.hide(); // menu-bar style
app.whenReady().then(async () => {
  createWindow();
  await createTray();
});

app.on('window-all-closed', (e) => e.preventDefault());

// ---- Helpers to run system commands ----
function sh(bin, args) {
  return new Promise((resolve) => {
    execFile(bin, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (err, out) => {
      resolve(err ? '' : (out || ''));
    });
  });
}

// ---- IPC: Ports ----
ipcMain.handle('getPorts', async () => {
  // lsof path is typically /usr/sbin/lsof on macOS
  const out = await sh('/usr/sbin/lsof', ['-nP', '-iTCP', '-sTCP:LISTEN']);
  const lines = out.split('\n').filter(Boolean);
  if (lines.length <= 1) return [];

  const rows = [];
  for (const line of lines.slice(1)) {
    // split on whitespace but keep COMMAND (may have no spaces typically)
    const cols = line.trim().split(/\s+/);
    if (cols.length < 9) continue;
    const cmd = cols[0];
    const pid = parseInt(cols[1], 10);
    const nameCol = cols.slice(8).join(' ');
    const m = nameCol.match(/:(\d+)\s/); // e.g. TCP *:8080 (LISTEN)
    const port = m ? parseInt(m[1], 10) : null;
    if (pid && port) rows.push({ pid, port, name: cmd });
  }

  // de-dup and sort
  const seen = new Set();
  return rows
    .filter(r => {
      const key = `${r.pid}-${r.port}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.port - b.port);
});

ipcMain.handle('killPort', async (e, port, force = true) => {
  const out = await sh('sudo', ['/usr/sbin/lsof', '-ti', `tcp:${port}`]);
  const pids = out.split('\n').filter(Boolean);
  if (!pids.length) return { ok: false, message: 'No PID for that port' };
  let ok = true;
  for (const p of pids) {
    try {
      const signal = force ? 'SIGKILL' : 'SIGTERM';
      await sh('sudo', ['kill', `-${signal}`, p]);
    } catch (err) {
      console.log(`Failed to kill PID ${p}:`, err.message);
      ok = false;
    }
  }
  return { ok };
});

ipcMain.handle('killPid', async (e, { pid, force }) => {
  console.log(`Attempting to kill PID ${pid} with force=${force}`);
  try {
    // Use sudo to kill processes that might be owned by root (like Next.js servers)
    const signal = force ? 'SIGKILL' : 'SIGTERM';
    console.log(`Running: sudo kill -${signal} ${pid}`);
    await sh('sudo', ['kill', `-${signal}`, pid]);
    console.log(`Successfully killed PID ${pid}`);
    return { ok: true };
  } catch (err) {
    console.log('sudo kill failed:', err.message);
    try {
      // Fallback to regular kill if sudo fails
      console.log('Trying regular kill as fallback');
      process.kill(parseInt(pid, 10), force ? 'SIGKILL' : 'SIGTERM');
      console.log(`Successfully killed PID ${pid} with regular kill`);
      return { ok: true };
    } catch (err2) {
      console.log('Regular kill also failed:', err2.message);
      return { ok: false, message: String(err2) };
    }
  }
});

// ---- IPC: Top memory ----
ipcMain.handle('getTopMemory', async (e, limit = 15) => {
  const out = await sh('/bin/ps', ['-axo', 'pid,comm,rss,pmem']);
  const lines = out.split('\n').filter(Boolean);
  const procs = [];
  for (const [i, line] of lines.entries()) {
    if (i === 0) continue; // header
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const pid = parseInt(parts[0], 10);
    const pmem = parseFloat(parts[parts.length - 1]) || 0;
    const rssKB = parseInt(parts[parts.length - 2], 10) || 0;
    const name = parts.slice(1, parts.length - 2).join(' ');
    if (pid) procs.push({ pid, name, rssKB, percent: pmem });
  }
  procs.sort((a, b) => b.rssKB - a.rssKB);
  return procs.slice(0, limit);
});
