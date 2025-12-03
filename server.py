from flask import Flask, jsonify, request, Response, send_from_directory
import subprocess
import threading
import os
import psutil

app = Flask(__name__)

current_process = None
process_lock = threading.Lock()

# NEW: Serve the main HTML page at root "/"
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

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

if __name__ == '__main__':
    print("PPPwn WebUI → http://127.0.0.1:8080")
    app.run(host='127.0.0.1', port=8080, debug=True)  # Added debug=True for error logs
