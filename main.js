const log = document.getElementById('log');
const fwSel = document.getElementById('fw');
const pppwnPanel = document.getElementById('pppwn-panel');
const bdjbPanel = document.getElementById('bdjb-panel');
const iface = document.getElementById('interface');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const prepBtn = document.getElementById('prep');
const filesDiv = document.getElementById('files');
let controller = null;

// Detect if running on GitHub Pages (demo mode)
const isDemo = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');

function L(t) {
  log.textContent += t + '\n';
  log.scrollTop = log.scrollHeight;
}

fwSel.onchange = () => {
  const fw = fwSel.value;
  const isPPPwn = fw === '1100';
  pppwnPanel.classList.toggle('hidden', !isPPPwn);
  bdjbPanel.classList.toggle('hidden', isPPPwn);
  filesDiv.innerHTML = '';
  L(`Selected FW ${fw} → ${isPPPwn ? 'PPPwn Ready' : 'BD-JB Prep'}`);
  if (isPPPwn && !isDemo) loadInterfaces();
};

// Only try to load interfaces in real local mode
async function loadInterfaces() {
  if (isDemo) return;
  try {
    const r = await fetch('/interfaces');
    const d = await r.ok ? await r.json() : [];
    iface.innerHTML = '';
    d.forEach(i => {
      let o = document.createElement('option');
      o.value = o.textContent = i;
      iface.appendChild(o);
    });
  } catch(e) { L('Interfaces load failed (normal in demo mode)'); }
}

// PPPwn Start/Stop (only works locally)
startBtn.onclick = async () => {
  if (isDemo) { L('PPPwn only works when running locally! Download the tool ↓'); return; }
  startBtn.disabled = true; stopBtn.disabled = false;
  L('Starting PPPwn...');
  controller = new AbortController();
  try {
    const r = await fetch('/run', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({interface: iface.value || 'Ethernet', fw: 1100, groomDelay: 22}),
      signal: controller.signal
    });
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      L(dec.decode(value));
    }
  } catch(e) { L('PPPwned or stopped'); }
  startBtn.disabled = false; stopBtn.disabled = true;
};

stopBtn.onclick = () => {
  if (controller) controller.abort();
  L('Stopped');
};

// Prep BD-JB Files — works everywhere!
prepBtn.onclick = async () => {
  filesDiv.innerHTML = '';
  L('Fetching latest BD-JB files...');

  if (isDemo) {
    // GitHub Pages demo → show direct links
    filesDiv.innerHTML = `
      <a href="https://github.com/GoldHEN/henloader_lp/releases/download/1.0/henloader_lp.iso" class="dl">Download HenLoader LP ISO (2.1 GB)</a><br>
      <a href="https://github.com/GoldHEN/GoldHEN/releases/download/2.4b18/GoldHEN_v2.4b18_payload.bin" class="dl">Download GoldHEN payload.bin</a><br>
      <a href="https://github.com/willysthecreator/PPPwn-WebUI/archive/refs/heads/main.zip" class="dl big">Download FULL TOOL (.zip) – Run Locally!</a>
    `;
    L('Ready! Download above and run python server.py for full features');
    return;
  }

  // Real local mode → use server
  try {
    const r = await fetch('/prep-bdjb', {method: 'POST'});
    if (!r.ok) throw new Error('Server error');
    const data = await r.json();
    filesDiv.innerHTML = `
      <a href="${data.iso}" download>HenLoader LP ISO (${data.iso_size})</a><br>
      <a href="${data.payload}" download>GoldHEN payload.bin</a><br>
      <a href="${data.zip}" download>Full AIO Prep ZIP</a>
    `;
    L('All files ready! Burn ISO + use USB → GoldHEN loads!');
  } catch(e) {
    L('Prep failed – are you running python server.py?');
  }
};

// Auto-init
if (!isDemo) loadInterfaces();
fwSel.onchange();
