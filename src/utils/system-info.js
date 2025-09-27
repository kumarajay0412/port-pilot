const { execFile } = require('child_process');

// Helper function to run system commands
function sh(bin, args) {
  return new Promise((resolve) => {
    execFile(bin, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (err, out) => {
      resolve(err ? '' : (out || ''));
    });
  });
}

// Get active ports data
async function getPortsData() {
  try {
    // Try both regular lsof and sudo lsof to catch all processes
    const regularOutput = await sh('/usr/sbin/lsof', ['-nP', '-iTCP', '-sTCP:LISTEN']);
    const sudoOutput = await sh('sudo', ['/usr/sbin/lsof', '-nP', '-iTCP', '-sTCP:LISTEN']);

    // Combine both outputs, filtering out headers
    const regularLines = regularOutput.split('\n').filter(line => line && !line.startsWith('COMMAND'));
    const sudoLines = sudoOutput.split('\n').filter(line => line && !line.startsWith('COMMAND'));

    const out = [...regularLines, ...sudoLines].join('\n');
    const lines = out.split('\n').filter(Boolean);

    if (lines.length <= 1) {
      return [];
    }

    const rows = [];
    for (const line of lines) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 9) continue;

      const cmd = cols[0];
      const pid = parseInt(cols[1], 10);
      const nameCol = cols.slice(8).join(' ');
      const m = nameCol.match(/:(\d+)\s/);
      const port = m ? parseInt(m[1], 10) : null;

      if (pid && port) {
        rows.push({ pid, port, name: cmd });
      }
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

// Get memory data with total system memory
async function getMemoryData() {
  try {
    const out = await sh('/bin/ps', ['-axo', 'pid,comm,rss,pmem']);
    const lines = out.split('\n').filter(Boolean);
    const procs = [];
    let usedMemoryKB = 0;

    for (const [i, line] of lines.entries()) {
      if (i === 0) continue; // header
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const pid = parseInt(parts[0], 10);
      const pmem = parseFloat(parts[parts.length - 1]) || 0;
      const rssKB = parseInt(parts[parts.length - 2], 10) || 0;
      const name = parts.slice(1, parts.length - 2).join(' ');
      if (pid) {
        procs.push({ pid, name, rssKB, percent: pmem });
        usedMemoryKB += rssKB;
      }
    }

    // Get total system memory using multiple methods
    let totalMemoryGB = 0;
    try {
      // Method 1: Try system_profiler first
      let totalMemOut = await sh('/usr/sbin/system_profiler', ['SPMemoryDataType']);

      // Try multiple patterns to match different output formats
      let totalMemMatch = totalMemOut.match(/Memory:\s+(\d+)\s+GB/i);
      if (totalMemMatch) {
        totalMemoryGB = parseInt(totalMemMatch[1]);
      } else {
        // Try alternative format
        totalMemMatch = totalMemOut.match(/Size:\s+(\d+)\s+GB/i);
        if (totalMemMatch) {
          totalMemoryGB = parseInt(totalMemMatch[1]);
        } else {
          // Try MB format
          totalMemMatch = totalMemOut.match(/Memory:\s+(\d+)\s+MB/i);
          if (totalMemMatch) {
            totalMemoryGB = Math.round(parseInt(totalMemMatch[1]) / 1024); // Convert MB to GB
          }
        }
      }

      // Method 2: Fallback to sysctl if system_profiler didn't work
      if (totalMemoryGB === 0) {
        try {
          const sysctlOut = await sh('/usr/sbin/sysctl', ['-n', 'hw.memsize']);
          const totalBytes = parseInt(sysctlOut.trim());
          totalMemoryGB = Math.round(totalBytes / (1024 * 1024 * 1024)); // Convert bytes to GB
          console.log('Detected memory via sysctl:', totalMemoryGB, 'GB');
        } catch (sysctlError) {
          console.error('sysctl memory detection failed:', sysctlError);
        }
      }

      console.log('Final detected total memory:', totalMemoryGB, 'GB');
    } catch (error) {
      console.error('Failed to detect system memory:', error);
      totalMemoryGB = 0;
    }

    const totalMemoryKB = totalMemoryGB * 1024 * 1024; // Convert GB to KB

    procs.sort((a, b) => b.rssKB - a.rssKB);
    const topProcs = procs.slice(0, 10); // Top 10 memory users

    return {
      processes: topProcs,
      totalMemoryKB,
      usedMemoryKB,
      totalMemoryGB,
      usedMemoryGB: usedMemoryKB / (1024 * 1024)
    };
  } catch (error) {
    console.error('Failed to get memory data:', error);
    return { processes: [], totalMemoryKB: 0, usedMemoryKB: 0, totalMemoryGB: 0, usedMemoryGB: 0 };
  }
}

module.exports = {
  getPortsData,
  getMemoryData,
  sh
};
