// ============================================================
//  control.js  —  LADO TELÉFONO (control remoto del auto)
//  Lee el MOVIMIENTO del auto (acelerómetro) y lo envía al
//  computador por PeerJS. Empujar el auto hacia adelante/atrás
//  hace avanzar/retroceder el gráfico en la pantalla del computador.
// ============================================================
// ============================================================
//  control.js  —  LADO TELÉFONO (control remoto del auto)
// ============================================================

(function () {
  const inputCodigo = document.getElementById("codigo");
  const btn    = document.getElementById("btnConectar");
  const estado = document.getElementById("estado");
  const movEl  = document.getElementById("tilt"); 

  const params = new URLSearchParams(location.search);
  if (params.get("code")) inputCodigo.value = params.get("code");

  let peer = null, conn = null, enviando = false;

  btn.addEventListener("click", conectar);

  async function conectar() {
    const code = (inputCodigo.value || "").trim();
    if (!/^\d{4}$/.test(code)) {
      estado.textContent = "Escribe el código de 4 dígitos del computador.";
      return;
    }

    const permiso = await pedirPermiso();
    if (permiso === "denegado") {
      estado.textContent = "Permiso de movimiento denegado. Actívalo y reintenta.";
      return;
    }
    if (permiso === "no-soportado") {
      estado.textContent = "Este teléfono no entrega sensor de movimiento.";
      return;
    }

    if (typeof Peer === "undefined") {
      estado.textContent = "No se pudo cargar la conexión. Revisa tu internet.";
      return;
    }

    estado.textContent = "Conectando…";
    
    // Configuración robusta para emparejar en la misma nube
    peer = new Peer({
      host: '0.peerjs.com',
      port: 443,
      secure: true
    });

    peer.on("open", () => {
      conn = peer.connect("bencinayautos-" + code);

      conn.on("open", () => {
        estado.textContent = "✅ Conectado. Empuja el auto hacia adelante.";
        btn.textContent = "Conectado ✓";
        btn.disabled = true;
        iniciarSensor();
      });

      conn.on("close", () => {
        estado.textContent = "Conexión cerrada. Toca para reconectar.";
        btn.disabled = false;
        btn.textContent = "Conectar y activar sensor";
      });
    });

    peer.on("error", (err) => {
      const tipo = err && err.type ? err.type : "?";
      estado.textContent = "No se pudo conectar (" + tipo + "). Reintenta.";
      btn.disabled = false;
    });
  }

  async function pedirPermiso() {
    if (typeof DeviceMotionEvent === "undefined") return "no-soportado";
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      try {
        const r = await DeviceMotionEvent.requestPermission();
        return r === "granted" ? "ok" : "denegado";
      } catch (e) { return "denegado"; }
    }
    return "ok"; 
  }

  function iniciarSensor() {
    if (enviando) return;
    enviando = true;

    let baseline = null;          
    let muestras = [];
    let ultimo = 0;

    window.addEventListener("devicemotion", (e) => {
      let ay = null;
      if (e.acceleration && e.acceleration.y !== null && e.acceleration.y !== undefined) {
        ay = e.acceleration.y;
      } else if (e.accelerationIncludingGravity && e.accelerationIncludingGravity.y !== null) {
        ay = e.accelerationIncludingGravity.y;
      }
      if (ay === null) return;

      const now = Date.now();
      if (now - ultimo < 33) return; 
      ultimo = now;

      if (baseline === null) {
        muestras.push(ay);
        if (muestras.length >= 20) {
          baseline = muestras.reduce((a, b) => a + b, 0) / muestras.length;
          estado.textContent = "✅ Listo. Empuja el chasis hacia adelante.";
        } else {
          estado.textContent = "Calibrando… deja el dispositivo quieto.";
        }
        return;
      }

      const mov = ay - baseline; 
      if (conn && conn.open) conn.send({ acc: mov });

      movEl.textContent = "Movimiento: " + mov.toFixed(1);
    }, true);
  }
})();