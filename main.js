const log = document.getElementById('log');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const iface = document.getElementById('interface');
let controller = null;

fetch('http://localhost:8080/interfaces').then(r=>r.json()).then(d=>d.forEach(i=>{let o=document.createElement('option');o.value=o.textContent=i;iface.appendChild(o)}));

function L(t){log.textContent+=t+'\n';log.scrollTop=log.scrollHeight}

startBtn.onclick=async()=>{startBtn.disabled=true;stopBtn.disabled=false;L('Starting PPPwn...');controller=new AbortController();
  try{const r=await fetch('http://localhost:8080/run',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({interface:iface.value||'Ethernet',fw:1100,groomDelay:22}),signal:controller.signal});
    const reader=r.body.getReader();const dec=new TextDecoder();
    while(true){const {done,value}=await reader.read();if(done)break;L(dec.decode(value))}}
  catch(e){L('Finished or stopped')}startBtn.disabled=false;stopBtn.disabled=true}
stopBtn.onclick=()=>{if(controller)controller.abort();L('Stopped');startBtn.disabled=false;stopBtn.disabled=true}
