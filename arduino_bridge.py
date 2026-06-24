"""
Servidor intermediario entre la página web y el Arduino.
Recibe comandos HTTP desde el navegador y los reenvía al Arduino por Serial.
"""

import argparse
import threading
import time
import serial
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)   # Permite llamadas desde cualquier origen (la página web)

# --- Estado global ---
arduino     = None
last_status = "IDLE"
lock        = threading.Lock()

def connect_arduino(port, baud=9600):
    global arduino
    try:
        arduino = serial.Serial(port, baud, timeout=2)
        time.sleep(2)   # esperar reset del Arduino
        line = arduino.readline().decode().strip()
        print(f"[Arduino] {line}")
        return True
    except Exception as e:
        print(f"[ERROR] No se pudo conectar al Arduino en {port}: {e}")
        return False

def send_command(cmd: str) -> str:
    """Envía un comando y espera la respuesta."""
    global last_status
    if arduino is None or not arduino.is_open:
        return "ERROR: Arduino no conectado"
    with lock:
        arduino.write((cmd + "\n").encode())
        time.sleep(0.05)
        resp = arduino.readline().decode().strip()
        last_status = resp
        return resp

@app.route("/move", methods=["POST"])
def move():
    """
    Recibe JSON: { "distance": 80, "speed": 200, "freq": 440 }
    Envía al Arduino: MOVE,80,200,440
    """
    data = request.get_json(force=True)
    dist  = int(data.get("distance", 30))
    speed = int(data.get("speed", 150))
    freq  = int(data.get("freq", 440))

    # Validaciones de seguridad
    dist  = max(1,  min(dist,  200))
    speed = max(50, min(speed, 255))
    freq  = max(0,  min(freq,  2000))

    cmd  = f"MOVE,{dist},{speed},{freq}"
    resp = send_command(cmd)
    return jsonify({"command": cmd, "response": resp})

@app.route("/stop", methods=["POST"])
def stop():
    resp = send_command("STOP")
    return jsonify({"response": resp})

@app.route("/status", methods=["GET"])
def status():
    return jsonify({"status": last_status, "connected": arduino is not None and arduino.is_open})

@app.route("/ping", methods=["GET"])
def ping():
    resp = send_command("PING")
    return jsonify({"response": resp})

# ============================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", default="/dev/ttyUSB0", help="Puerto serie del Arduino")
    parser.add_argument("--baud", type=int, default=9600)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--flask-port", type=int, default=5000)
    args = parser.parse_args()

    connected = connect_arduino(args.port, args.baud)
    if not connected:
        print("[AVISO] Iniciando servidor sin Arduino (modo simulación)")

    print(f"[Bridge] Escuchando en http://{args.host}:{args.flask_port}")
    app.run(host=args.host, port=args.flask_port, debug=False)