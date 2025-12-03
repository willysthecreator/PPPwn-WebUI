const log = document.getElementById('log');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const iface = document.getElementById('interface');
const fwSel = document.getElementById('fw');
const bdjbPanel = document.getElementById('bdjb-panel');
const prepBtn = document.getElementById('prep');
const filesDiv = document.getElementById('files');
const toggleBtn = document.getElementById('toggle-fw');
let controller = null;

// Detect demo mode (GitHub Pages)
const isDemo = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');

function L(t){log.textContent+=t+'\n';log.scrollTop=log.scrollHeight}

async function loadInterfaces(){
  if(isDemo) return L('Demo mode – download for full PPPwn');
  try{
    const r=await fetch('http://localhost:8080/interfaces');
    const d=await r.json();
    iface.innerHTML='';
    d.forEach(i=>{let o=document.createElement('option');o.value=o.textContent=i;iface.appendChild(o)});
    L('Interfaces loaded');
  }catch(e){L('Interfaces failed – run python server.py?')}
}

startBtn.onclick=async()=>{
  if(isDemo){L('Download & run locally for PPPwn!');return;}
  startBtn.disabled=true;stopBtn.disabled=false;L('Starting PPPwn...');
  controller=new AbortController();
  try{
    const r=await fetch('http://localhost:8080/run',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({interface:iface.value||'Ethernet',fw:1100,groomDelay:22}),signal:controller.signal});
    const reader=r.body.getReader();const dec=new TextDecoder();
    while(true){const {done,value}=await reader.read();if(done)break;L(dec.decode(value))}
  }catch(e){L('PPPwned or stopped! GoldHEN should load.')}
  startBtn.disabled=false;stopBtn.disabled=true;
};

stopBtn.onclick=()=>{
  if(controller)controller.abort();L('Stopped');
};

// AIO Toggle (optional – keeps PPPwn default)
toggleBtn.onclick=()=>{
  const isAIO = fwSel.parentElement.style.display !== 'none';
  if(isAIO){
    // Back to PPPwn
    fwSel.parentElement.style.display='none';
    bdjbPanel.classList.add('hidden');
    toggleBtn.textContent='Switch to AIO';
    L('Back to PPPwn 11.00 – Connect Ethernet & press X');
    loadInterfaces();
  }else{
    // To AIO
    fwSel.parentElement.style.display='inline-block';
    toggleBtn.textContent='Back to PPPwn';
    L('AIO Mode: Select FW for Lapse/GoldHEN prep');
  }
};

// Prep BD-JB (direct to your links – always works, no errors)
prepBtn.onclick=()=>{
  filesDiv.innerHTML='';
  L('Prepping your Lapse v1.2 AIO + GoldHEN files...');
  // Your exact links
  filesDiv.innerHTML=`
    <a href="https://www.mediafire.com/file/80v7gw2qxyar6sz/Lapse-v1.2-AIO-Update.iso/file" download class="big">🔥 Lapse v1.2 AIO ISO (256MB – Burn to BD-R)</a><br>
    <a href="https://ko-fi.com/s/bd655acbdb" download>💾 GoldHEN v2.4b18.5 Payload (USB – Latest Beta)</a><br>
    <a href="https://github.com/willysthecreator/PPPwn-WebUI/archive/refs/heads/main.zip" download class="big">📦 Full Tool ZIP (For PPPwn 11.00)</a>
  `;
  L('Ready! Burn ISO (ImgBurn), copy payload to USB, insert both → Circle in BD Player → GoldHEN loads (9.00–12.02; Poops for 12.52).');
};

// Init: PPPwn default
loadInterfaces();
L('PPPwn ready for 11.00 – Ethernet + X on Test Connection');
