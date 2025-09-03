const $ = (q) => document.querySelector(q);
const portsList = $('#portsList');
const memList = $('#memList');

// Track current active tab
let currentTab = 'ports'; // 'ports' or 'mem'

async function loadPorts() {
    const rows = await window.portpilot.getPorts();
    console.log('Loaded ports:', rows);
    portsList.innerHTML = rows.map(r => `
    <div class="row">
      <div class="grow mono">${r.name}</div>
      <div class="mono muted">:${r.port}</div>
      <div class="mono muted">PID ${r.pid}</div>
      <div class="actions">
        <button data-pid="${r.pid}" class="kill">Kill</button>
      </div>
    </div>
  `).join('');
    portsList.querySelectorAll('.kill').forEach(btn => {
        btn.addEventListener('click', async () => {
            const pid = parseInt(btn.dataset.pid, 10);
            console.log('Kill button clicked for PID:', pid);
            const result = await window.portpilot.killPid(pid, true);
            console.log('Kill result:', result);
            if (result.ok) {
                console.log('Process killed successfully, reloading ports...');
            } else {
                console.error('Failed to kill process:', result.message);
            }
            await loadPorts();
        });
    });
}

function kbToHuman(kb) {
    let v = kb * 1024;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (v > 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(1)} ${units[i]}`;
}

async function loadMem() {
    const rows = await window.portpilot.getTopMemory(15);
    memList.innerHTML = rows.map(r => `
    <div class="row">
      <div class="grow mono">${r.name}</div>
      <div class="mono muted">PID ${r.pid}</div>
      <div class="mono">${kbToHuman(r.rssKB)}</div>
      <div class="mono muted">${r.percent.toFixed(1)}%</div>
      <div class="actions">
        <button data-pid="${r.pid}" class="quit">Quit</button>
        <button data-pid="${r.pid}" class="force">Force</button>
      </div>
    </div>
  `).join('');
    memList.querySelectorAll('.quit').forEach(btn => {
        btn.addEventListener('click', async () => {
            await window.portpilot.killPid(parseInt(btn.dataset.pid, 10), false);
            await loadMem();
        });
    });
    memList.querySelectorAll('.force').forEach(btn => {
        btn.addEventListener('click', async () => {
            await window.portpilot.killPid(parseInt(btn.dataset.pid, 10), true);
            await loadMem();
        });
    });
}

$('#refresh').addEventListener('click', async () => {
    console.log('Refresh clicked, current tab:', currentTab);
    if (currentTab === 'ports') {
        console.log('Loading ports...');
        await loadPorts();
    } else if (currentTab === 'mem') {
        console.log('Loading memory...');
        await loadMem();
    }
});

$('#tab-ports').addEventListener('click', async () => {
    $('#tab-ports').classList.add('active'); $('#tab-mem').classList.remove('active');
    $('#portsView').style.display = 'block'; $('#memView').style.display = 'none';
    currentTab = 'ports';
    await loadPorts();
});

$('#tab-mem').addEventListener('click', async () => {
    $('#tab-mem').classList.add('active'); $('#tab-ports').classList.remove('active');
    $('#memView').style.display = 'block'; $('#portsView').style.display = 'none';
    currentTab = 'mem';
    await loadMem();
});

$('#killPortBtn').addEventListener('click', async () => {
    const val = parseInt($('#killPortInput').value, 10);
    if (!val) return;
    await window.portpilot.killPort(val, true);
    await loadPorts();
});

// initial
loadPorts();
