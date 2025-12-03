from flask import Flask, jsonify, request, Response, send_file
import subprocess, threading, os, json, psutil, zipfile, io, requests
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
    # HenLoader ISO (latest v1.0)
    iso_url = 'https://github.com/GoldHEN/henloader_lp/releases/download/1.0/henloader_lp.iso'
    # GoldHEN latest (update URL as needed; from Ko-fi/GitHub)
    goldhen_url = 'https://github.com/GoldHEN/GoldHEN/releases/download/2.4b18/GoldHEN_v2.4b18_payload.bin'  # Adjust to actual
    # Or dynamic: fetch API
    # resp = requests.get('https://api.github.com/repos/GoldHEN/GoldHEN/releases/latest')
    # assets = resp.json()['assets']
    # goldhen_url = next(a['browser_download_url'] for a in assets if 'payload' in a['name'])

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        # Download ISO
        iso_resp = requests.get(iso_url)
        z.writestr('henloader_lp.iso', io.BytesIO(iso_resp.content).getvalue())
        # Download GoldHEN (simplified; extract if 7z)
        gh_resp = requests.get(goldhen_url)
        z.writestr('payload.bin', io.BytesIO(gh_resp.content).getvalue())
        # Guide
        guide = """PS4 12.xx BD-JB Guide:
1. Install ImgBurn (free): imgburn.com
2. Burn henloader_lp.iso to BD-R disc (slow speed).
3. Format USB FAT32 (Rufus), copy payload.bin to root.
4. PS4: Insert USB + disc → Blu-ray Player → BD Live: Yes
5. 12.50/52: Press ⭕ (Poops) → GoldHEN loads!
Next time: No USB needed."""
        z.writestr('README-burn.txt', guide)
    
    buf.seek(0)
    return jsonify({
        "iso": "/static/henloader.iso",
        "payload": "/static/payload.bin",
        "zip": "/static/aio-prep.zip",
        "iso_size": f"{len(iso_resp.content)/1024/1024:.1f}MB"
    })

# Static serves for downloads (Flask serves /static)
@app.route('/static/<path:filename>')
def static_files(filename):
    # Proxy downloads
    if filename == 'henloader.iso':
        return send_file('temp_henloader.iso', as_attachment=True)  # Pre-download if needed
    # etc.
    return send_file(filename, as_attachment=True)

if __name__ == '__main__':
    print("PS4 AIO WebUI v2.0 → http://localhost:8080")
    app.run(host='127.0.0.1', port=8080, debug=False)
