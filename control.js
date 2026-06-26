// ============================================================
//  control.js  —  LADO TELÉFONO (control remoto del auto)
//  Lee el MOVIMIENTO del auto (acelerómetro) y lo envía al
//  computador por PeerJS. Empujar el auto hacia adelante/atrás
//  hace avanzar/retroceder el gráfico en la pantalla del computador.
// ============================================================

(function () {
  const inputCodigo = document.getElementById("codigo");
  const btn    = document.getElementById("btnConectar");
  const estado = document.getElementById("estado");
  const movEl  = document.getElementById("tilt"); // reutilizamos el elemento

  // Si el código viene en la URL (al escanear el QR), lo rellenamos
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

    // Permiso del sensor de MOVIMIENTO (obligatorio en iPhone) — pedir con un toque
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
    peer = new Peer();

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
      estado.textContent = "No se pudo conectar (" + tipo + "). Verifica el código y el internet.";
      btn.disabled = false;
    });
  }

  // En iPhone, el sensor de movimiento (DeviceMotion) requiere permiso explícito
  async function pedirPermiso() {
    if (typeof DeviceMotionEvent === "undefined") return "no-soportado";
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      try {
        const r = await DeviceMotionEvent.requestPermission();
        return r === "granted" ? "ok" : "denegado";
      } catch (e) { return "denegado"; }
    }
    return "ok"; // Android no requiere permiso explícito
  }

  // ============================================================
  //  LECTURA DEL ACELERÓMETRO
  //  Usamos el eje Y del teléfono (su lado largo) como "adelante/atrás".
  //  Monta el teléfono con la parte de arriba apuntando al frente del auto.
  // ============================================================
  function iniciarSensor() {
    if (enviando) return;
    enviando = true;

    let baseline = null;          // valor en reposo (para restar el sesgo/gravedad)
    let muestras = [];
    let ultimo = 0;

    window.addEventListener("devicemotion", (e) => {
      // Preferimos la aceleración SIN gravedad; si no existe, usamos la que la incluye
      let ay = null;
      if (e.acceleration && e.acceleration.y !== null && e.acceleration.y !== undefined) {
        ay = e.acceleration.y;
      } else if (e.accelerationIncludingGravity && e.accelerationIncludingGravity.y !== null) {
        ay = e.accelerationIncludingGravity.y;
      }
      if (ay === null) return;

      const now = Date.now();
      if (now - ultimo < 33) return; // ~30 envíos por segundo
      ultimo = now;

      // Calibración inicial (~0.7 s): el auto debe estar quieto al conectar
      if (baseline === null) {
        muestras.push(ay);
        if (muestras.length >= 20) {
          baseline = muestras.reduce((a, b) => a + b, 0) / muestras.length;
          estado.textContent = "✅ Listo. Empuja el auto hacia adelante.";
        } else {
          estado.textContent = "Calibrando… deja el auto quieto un segundo.";
        }
        return;
      }

      const mov = ay - baseline; // movimiento real (m/s²) respecto al reposo
      if (conn && conn.open) conn.send({ acc: mov });

      movEl.textContent = "Movimiento: " + mov.toFixed(1);
    }, true);
  }
})();
