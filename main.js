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

fwSel.onchange = () => {
  const fw = fwSel.value;
  pppwnPanel.classList.toggle('hidden', fw <= '1100' ? false : true);
  bdjbPanel.classList.toggle('hidden', fw <= '1100' ? true : false);
  L(`Selected FW ${fw} → ${fw <= '1100' ? 'PPPwn Ready' : 'BD-JB Prep'}`);
  if (fw <= '1100') loadInterfaces();
};

async function loadInterfaces() {
  try {
    const r = await fetch('/interfaces');
    const d = await r.json();
    iface.innerHTML = '';
    d.forEach(i => {
      let o = document.createElement('option');
      o.value = o.textContent = i;
      iface.appendChild(o);
    });
  } catch(e) { L('Interfaces load failed'); }
}

function L(t) {
  log.textContent += t + '\n';
  log.scrollTop = log.scrollHeight;
}

startBtn.onclick = async () => {
  startBtn.disabled = true; stopBtn.disabled = false;
  L('🚀 Starting PPPwn...');
  controller = new AbortController();
  try {
    const r = await fetch('/run', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        interface: iface.value || 'Ethernet',
        fw: parseInt(fwSel.value),
        groomDelay: 22
      }),
      signal: controller.signal
    });
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      L(dec.decode(value));
    }
  } catch(e) { L('✅ PPPwned or stopped!'); }
  startBtn.disabled = false; stopBtn.disabled = true;
};

stopBtn.onclick = () => {
  if (controller) controller.abort();
  L('⏹️ Stopped');
};

prepBtn.onclick = async () => {
  prepBtn.disabled = true;
  L('📥 Fetching latest BD-JB files...');
  try {
    const r = await fetch('/prep-bdjb', {method: 'POST'});
    const data = await r.json();
    filesDiv.innerHTML = `
      <a href="${data.iso}" download>🔥 HenLoader ISO (${data.iso_size})</a>
      <a href="${data.payload}" download>💾 GoldHEN payload.bin</a>
      <a href="${data.zip}" download>📦 Full Prep ZIP (ISO + USB + Guide)</a>
    `;
    L(`✅ Ready! Burn ISO → USB payload.bin → Insert both → Blu-ray Player → ${fwSel.value >= '1250' ? '⭕ Poops' : '❌ Lapse'}`);
  } catch(e) { L('Prep failed – check net'); }
  prepBtn.disabled = false;
};

loadInterfaces(); fwSel.onchange();
