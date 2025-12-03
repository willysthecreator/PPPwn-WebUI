from flask import Flask, jsonify, request, Response, send_file
import subprocess
import threading
import os
import psutil
import zipfile
import io
import requests
import time
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # For API calls

current_process = None
process_lock = threading.Lock()

@app.route('/interfaces')
def get_interfaces():
    interfaces = list(psutil.net_if_addrs().keys())
    filtered = [i for i in interfaces if not i.lower().startswith(('lo', 'docker', 'br-', 'vmnet'))]
    return jsonify(filtered or interfaces)

@app.route('/run', methods=['POST'])
def run_pppwn():
    global current_process
    with process_lock:
        if current_process and current_process.poll() is None:
            return jsonify({"error": "Already running"}), 400
        data = request.json or {}
        interface = data.get('interface', 'Ethernet')
        fw = data.get('fw', 1100)
        if not os.path.isfile('pppwn.py'):
            return jsonify({"error": "pppwn.py missing!"}), 500
        cmd = ['python', 'pppwn.py', '--interface', interface, '--fw', str(fw), '--groom-delay', '22', '--timeout', '35']
        try:
            current_process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1, cwd=os.path.dirname(__file__))
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return Response(stream_pppwn(), mimetype='text/plain')

def stream_pppwn():
    global current_process
    while current_process and current_process.poll() is None:
        line = current_process.stdout.readline()
        if line:
            yield line
    current_process = None

@app.route('/stop', methods=['POST'])
def stop_pppwn():
    global current_process
    with process_lock:
        if current_process and current_process.poll() is None:
            current_process.terminate()
            current_process = None
    return jsonify({"status": "Stopped"})

@app.route('/prep-bdjb', methods=['POST'])
def prep_bdjb():
    try:
        # Official HenLoader LP 1.0 ISO (supports 9.00-12.52 Poops/Lapse, embeds GoldHEN 2.4b18.7)
        iso_url = 'https://github.com/GoldHEN/henloader_lp/releases/download/1.0/henloader_lp.iso'
        
        # Official GoldHEN 2.4b18 payload (for USB update/persistence – latest as of Oct 28, 2025)
        goldhen_url = 'https://github.com/GoldHEN/GoldHEN/releases/download/2.4b18/GoldHEN_v2.4b18_payload.bin'
        
        # Download with retry (handles GitHub hiccups)
        def download_with_retry(url, retries=3):
            for attempt in range(retries):
                try:
                    resp = requests.get(url, stream=True, timeout=30)
                    resp.raise_for_status()
                    return resp.content
                except Exception as e:
                    print(f"Download attempt {attempt+1} failed: {e}")
                    if attempt < retries - 1:
                        time.sleep(2)
                    else:
                        raise e
        iso_content = download_with_retry(iso_url)
        goldhen_content = download_with_retry(goldhen_url)
        
        # Create ZIP in memory
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr('henloader_lp.iso', iso_content)
            z.writestr('payload.bin', goldhen_content)  # For USB
            guide = """PS4 12.xx BD-JB Guide (HenLoader LP 1.0):
1. Download ImgBurn (free): imgburn.com
2. Burn henloader_lp.iso to BD-R disc (4x speed max for stability).
3. Format USB FAT32 (MBR via Rufus) → copy payload.bin to root.
4. PS4: Insert USB + disc → Blu-ray Player → Allow BD Live: Yes
5. For 12.50/12.52: Press ⭕ (Circle) → GoldHEN 2.4b18.7 loads in ~30s!
6. Next boot: Just disc (no USB) if GoldHEN is copied to /data.
Troubleshoot: Enable HDCP, disable PSN sign-in, retry on eject."""
            z.writestr('README.txt', guide)
        
        buf.seek(0)
        
        # Save temp files for direct links (Flask serves them)
        with open('temp_henloader.iso', 'wb') as f:
            f.write(iso_content)
        with open('temp_payload.bin', 'wb') as f:
            f.write(goldhen_content)
        with open('temp_aio.zip', 'wb') as f:
            f.write(buf.getvalue())
        
        return jsonify({
            "iso": "/static/temp_henloader.iso",
            "payload": "/static/temp_payload.bin",
            "zip": "/static/temp_aio.zip",
            "iso_size": f"{len(iso_content)/1024/1024:.1f}MB"
        })
    except Exception as e:
        return jsonify({"error": f"Download failed: {str(e)}. Check internet/GitHub."}), 500

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_file(filename, as_attachment=True)

if __name__ == '__main__':
    print("PS4 AIO WebUI v2.0 → http://localhost:8080")
    app.run(host='127.0.0.1', port=8080, debug=False)
