const { sh } = require('./system-info');

// Kill a process by PID
async function killProcess(pid, force = true) {
  try {
    const signal = force ? 'SIGKILL' : 'SIGTERM';
    await sh('sudo', ['kill', `-${signal}`, pid.toString()]);
    return true;
  } catch (err) {
    try {
      process.kill(parseInt(pid, 10), force ? 'SIGKILL' : 'SIGTERM');
      return true;
    } catch (err2) {
      console.error('Failed to kill process:', err2.message);
      return false;
    }
  }
}

// Kill all processes using a specific port
async function killPort(port, force = true) {
  const out = await sh('sudo', ['/usr/sbin/lsof', '-ti', `tcp:${port}`]);
  const pids = out.split('\n').filter(Boolean);
  if (!pids.length) return { ok: false, message: 'No PID for that port' };
  let ok = true;
  for (const p of pids) {
    try {
      const signal = force ? 'SIGKILL' : 'SIGTERM';
      await sh('sudo', ['kill', `-${signal}`, p]);
    } catch (err) {
      ok = false;
    }
  }
  return { ok };
}

// Kill a specific PID with IPC handler
async function killPid({ pid, force }) {
  try {
    const signal = force ? 'SIGKILL' : 'SIGTERM';
    await sh('sudo', ['kill', `-${signal}`, pid]);
    return { ok: true };
  } catch (err) {
    try {
      process.kill(parseInt(pid, 10), force ? 'SIGKILL' : 'SIGTERM');
      return { ok: true };
    } catch (err2) {
      return { ok: false, message: String(err2) };
    }
  }
}

module.exports = {
  killProcess,
  killPort,
  killPid
};
