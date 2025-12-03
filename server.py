from flask import Flask, jsonify, request
import subprocess, threading, os, json, psutil

app = Flask(__name__)

@app.route('/interfaces')
def interfaces(): return jsonify(list(psutil.net_if_addrs().keys()))

@app.route('/run', methods=['POST'])
def run():
    data = request.json
    cmd = ['python', 'pppwn.py', '--interface', data.get('interface','Ethernet'), '--fw', '1100', '--groom-delay', '22', '--timeout', '35']
    def stream():
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd=os.path.dirname(__file__))
        for l in p.stdout: yield l.decode(errors='ignore')
    threading.Thread(target=stream, daemon=True).start()
    return "Started", 200

if __name__ == '__main__': app.run(port=8080)
