// ============================================================
//  control.js  —  LADO TELÉFONO (control remoto del auto)
//  Lee la inclinación del teléfono y la envía al computador por PeerJS.
//  El computador (index.html) recibe esos datos y mueve el gráfico.
// ============================================================

(function () {
  const inputCodigo = document.getElementById("codigo");
  const btn    = document.getElementById("btnConectar");
  const estado = document.getElementById("estado");
  const tiltEl = document.getElementById("tilt");

  // Si el código viene en la URL (al escanear el QR), lo rellenamos
  const params = new URLSearchParams(location.search);
  if (params.get("code")) inputCodigo.value = params.get("code");

  let peer = null, conn = null, enviando = false, betaRef = null;

  btn.addEventListener("click", conectar);

  async function conectar() {
    const code = (inputCodigo.value || "").trim();
    if (!/^\d{4}$/.test(code)) {
      estado.textContent = "Escribe el código de 4 dígitos del computador.";
      return;
    }

    // Permiso del sensor (obligatorio en iPhone) — debe pedirse con un toque
    const permiso = await pedirPermiso();
    if (permiso === "denegado") {
      estado.textContent = "Permiso de movimiento denegado. Actívalo y reintenta.";
      return;
    }
    if (permiso === "no-soportado") {
      estado.textContent = "Este teléfono no entrega sensores de movimiento.";
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
        estado.textContent = "✅ Conectado. Inclina el auto hacia adelante.";
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

  async function pedirPermiso() {
    if (typeof DeviceOrientationEvent === "undefined") return "no-soportado";
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        const r = await DeviceOrientationEvent.requestPermission();
        return r === "granted" ? "ok" : "denegado";
      } catch (e) { return "denegado"; }
    }
    return "ok"; // Android no requiere permiso explícito
  }

  function iniciarSensor() {
    if (enviando) return;
    enviando = true;
    let ultimo = 0;

    window.addEventListener("deviceorientation", (e) => {
      if (e.beta === null || e.beta === undefined) return;
      const now = Date.now();
      if (now - ultimo < 33) return; // ~30 envíos por segundo
      ultimo = now;

      if (conn && conn.open) conn.send({ beta: e.beta });

      // Indicador visual de inclinación en el teléfono
      if (betaRef === null) betaRef = e.beta;
      const inc = Math.round(e.beta - betaRef);
      tiltEl.textContent = "Inclinación: " + inc + "°";
    }, true);
  }
})();
