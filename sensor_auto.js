// ============================================================
//  sensor_auto.js  —  Modo Auto (LADO COMPUTADOR / PANTALLA)
//  Bencina y Autos · proyecto de visualización
//
//  ARQUITECTURA:
//    [ TELÉFONO sobre el auto ]  --(inclinación)-->  [ COMPUTADOR ]
//        control.html / control.js                   index.html (esta pantalla)
//                         \___ PeerJS (WebRTC) ___/
//
//  Este archivo corre en el COMPUTADOR:
//   - Crea un código de emparejamiento + QR para que el teléfono se conecte.
//   - Recibe la inclinación del teléfono y hace AVANZAR el recorrido:
//     todas las barras crecen hasta su límite de presupuesto.
//   - Cuando un país llega a su límite: congela la barra, pita
//     (agudo = bencina cara, rápido = auto ineficiente) y lo dice por voz.
//   - Suena un motor mientras el auto se mueve.
//
//  Depende de window.App (definido en script.js) y de PeerJS (window.Peer).
//  Para PROBAR sin teléfono: usa las flechas ↑ ↓ del teclado.
// ============================================================

const SensorAuto = (() => {

  // ---- Calibración (ajustable) ----
  const ZONA_MUERTA_GRADOS = 6;     // inclinación mínima para empezar a avanzar
  const INCLINACION_MAX     = 35;   // grados = velocidad máxima
  const SEG_RECORRIDO_TOTAL = 6;    // segundos en cruzar todo a tope
  let   invertirDireccion   = false;

  // ---- Estado ----
  let activo = false;
  let betaRef = null;     // ángulo "plano" de referencia (calibrado al conectar)
  let betaActual = null;  // última inclinación recibida del teléfono
  let ultimoT = 0;
  let rafId = null;

  // ---- Audio ----
  let ctx = null, motorOsc = null, motorGain = null, motorFiltro = null;

  // ---- Conexión (PeerJS) ----
  let peer = null, conn = null, codigo = null;

  // ============================================================
  function init() {
    const btn = document.getElementById("btnModoAuto");
    if (btn) btn.addEventListener("click", alternar);

    const chk = document.getElementById("chkInvertir");
    if (chk) chk.addEventListener("change", e => { invertirDireccion = e.target.checked; });

    // Prueba sin teléfono: flechas del teclado
    window.addEventListener("keydown", (e) => {
      if (!activo) return;
      if (e.key === "ArrowUp")   { App.avanzar(App.getMaxKm() * 0.04); revMotorMomentaneo(); }
      if (e.key === "ArrowDown") { App.avanzar(-App.getMaxKm() * 0.04); }
    });
  }

  async function alternar() {
    if (activo) { detener(); return; }
    iniciar();
  }

  function iniciar() {
    iniciarAudio();                 // el clic del botón habilita el sonido
    betaRef = null; betaActual = null;
    activo = true; ultimoT = 0;
    App.reiniciar();
    App.setModoAuto(true);

    const btn = document.getElementById("btnModoAuto");
    if (btn) { btn.textContent = "■ Detener modo auto"; btn.classList.add("activo"); }

    iniciarConexion();
    rafId = requestAnimationFrame(bucle);
  }

  function detener() {
    activo = false;
    if (rafId) cancelAnimationFrame(rafId);
    pararMotor();
    App.setModoAuto(false);
    cerrarConexion();

    const btn = document.getElementById("btnModoAuto");
    if (btn) { btn.textContent = "▶ Iniciar modo auto"; btn.classList.remove("activo"); }
    const panel = document.getElementById("panelConexion");
    if (panel) panel.style.display = "none";
    setEstado("Modo auto detenido.");
  }

  // ============================================================
  //  CONEXIÓN — el computador es el "anfitrión" (host)
  // ============================================================
  function iniciarConexion() {
    if (typeof Peer === "undefined") {
      setEstado("No se cargó la librería de conexión (revisa tu internet). Puedes probar con las flechas ↑ ↓.");
      return;
    }
    codigo = nuevoCodigo();
    crearPeer(0);
  }

  function nuevoCodigo() {
    return String(Math.floor(1000 + Math.random() * 9000)); // 4 dígitos
  }

  function crearPeer(intento) {
    try {
      peer = new Peer("bencinayautos-" + codigo);
    } catch (e) {
      setEstado("Error iniciando la conexión.");
      return;
    }

    peer.on("open", () => mostrarPanel());

    peer.on("error", (err) => {
      const tipo = err && err.type ? err.type : "?";
      // Si el código ya está en uso, generamos otro
      if (tipo === "unavailable-id" && intento < 3) {
        codigo = nuevoCodigo();
        crearPeer(intento + 1);
      } else {
        setEstado("Problema de conexión (" + tipo + "). Reintenta con 'Detener' e 'Iniciar', o usa las flechas ↑ ↓.");
      }
    });

    peer.on("connection", (c) => {
      conn = c;
      conn.on("open", () => {
        betaRef = null;           // recalibrar al conectar
        App.reiniciar();
        setEstado("📱 Teléfono conectado. Inclina el auto hacia ADELANTE para avanzar.");
      });
      conn.on("data", (d) => {
        if (d && typeof d.beta === "number") {
          betaActual = d.beta;
          if (betaRef === null) betaRef = d.beta;
        }
      });
      conn.on("close", () => {
        pararMotor();
        setEstado("📵 Teléfono desconectado. Vuelve a tocar 'Conectar' en el teléfono.");
      });
    });
  }

  function mostrarPanel() {
    const panel = document.getElementById("panelConexion");
    const codEl = document.getElementById("codigoConexion");
    const urlEl = document.getElementById("urlControl");
    const qrEl  = document.getElementById("qrConexion");

    const controlURL = new URL("control.html", location.href).href;
    const fullURL = controlURL + "?code=" + codigo;

    if (codEl) codEl.textContent = codigo;
    if (urlEl) urlEl.textContent = controlURL;
    if (qrEl) {
      qrEl.innerHTML = "";
      try {
        if (typeof QRCode !== "undefined") new QRCode(qrEl, { text: fullURL, width: 170, height: 170 });
      } catch (e) { /* el QR es opcional: el código escrito basta */ }
    }
    if (panel) panel.style.display = "flex";
    setEstado("Esperando al teléfono… Código " + codigo + ". Abre control.html en el celular o escanea el QR.");
  }

  function cerrarConexion() {
    try { if (conn) conn.close(); } catch (e) {}
    try { if (peer) peer.destroy(); } catch (e) {}
    conn = null; peer = null;
  }

  // ============================================================
  //  BUCLE: integra la inclinación recibida → avance del recorrido
  // ============================================================
  function bucle(t) {
    if (!activo) return;
    if (ultimoT === 0) ultimoT = t;
    const dt = Math.min((t - ultimoT) / 1000, 0.1);
    ultimoT = t;

    let factor = 0;
    if (betaActual !== null && betaRef !== null) {
      let inc = betaActual - betaRef;
      if (invertirDireccion) inc = -inc;
      if (Math.abs(inc) > ZONA_MUERTA_GRADOS) {
        factor = Math.sign(inc) * Math.min(Math.abs(inc), INCLINACION_MAX) / INCLINACION_MAX;
      }
    }

    const velocidad = factor * (App.getMaxKm() / SEG_RECORRIDO_TOTAL);
    if (velocidad !== 0) App.avanzar(velocidad * dt);

    actualizarMotor(Math.abs(factor), App.getProgreso());
    rafId = requestAnimationFrame(bucle);
  }

  // ============================================================
  //  AUDIO: motor continuo
  // ============================================================
  function iniciarAudio() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    if (!motorOsc) {
      motorOsc = ctx.createOscillator();
      motorGain = ctx.createGain();
      motorFiltro = ctx.createBiquadFilter();
      motorOsc.type = "sawtooth";
      motorOsc.frequency.value = 70;
      motorFiltro.type = "lowpass";
      motorFiltro.frequency.value = 600;
      motorGain.gain.value = 0;
      motorOsc.connect(motorFiltro);
      motorFiltro.connect(motorGain);
      motorGain.connect(ctx.destination);
      motorOsc.start();
    }
  }

  function actualizarMotor(velocidad01, progreso01) {
    if (!ctx || !motorOsc) return;
    const freq = 55 + velocidad01 * 130 + progreso01 * 50;
    motorOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
    const vol = velocidad01 > 0.02 ? 0.07 : 0.0;
    motorGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
  }

  function revMotorMomentaneo() {
    if (!ctx || !motorGain) return;
    motorGain.gain.setTargetAtTime(0.07, ctx.currentTime, 0.02);
    motorGain.gain.setTargetAtTime(0.0,  ctx.currentTime + 0.15, 0.1);
  }

  function pararMotor() {
    if (motorGain && ctx) motorGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  }

  // ============================================================
  //  AVISO cuando un país se queda sin presupuesto
  //  tono más agudo = bencina más cara · ritmo más rápido = más ineficiente
  //  (llamado desde script.js / App)
  // ============================================================
  function anunciarAgotado(pais, precio, consumo) {
    if (!ctx) iniciarAudio();
    const r = App.getRangos();
    const freq = mapear(precio, r.minPrecio, r.maxPrecio, 220, 1000);
    const intervalo = mapear(consumo, r.minConsumo, r.maxConsumo, 90, 260);
    const pulsos = 4;
    for (let i = 0; i < pulsos; i++) setTimeout(() => pitido(freq), i * intervalo);
    setTimeout(() => hablar(`Se acabó el presupuesto de ${pais}`), pulsos * intervalo + 80);
  }

  function pitido(freq) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.12);
  }

  function hablar(texto) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "es-ES"; u.rate = 1.05;
    const voces = window.speechSynthesis.getVoices();
    const vozEs = voces.find(v => v.lang && v.lang.toLowerCase().startsWith("es"));
    if (vozEs) u.voice = vozEs;
    window.speechSynthesis.speak(u);
  }

  function anunciarFin() {
    pararMotor();
    setTimeout(() => hablar("Todos los países llegaron a su límite de presupuesto"), 200);
    setEstado("✅ Todos los países llegaron a su límite. Toca 'Detener' para terminar.");
  }

  // ---- utilidades ----
  function mapear(v, inMin, inMax, outMin, outMax) {
    const t = Math.max(0, Math.min(1, (v - inMin) / (inMax - inMin || 1)));
    return outMin + t * (outMax - outMin);
  }
  function setEstado(txt) {
    const el = document.getElementById("estadoModoAuto");
    if (el) el.textContent = txt;
  }

  return { init, anunciarAgotado, anunciarFin };
})();

if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = () => {};
document.addEventListener("DOMContentLoaded", () => SensorAuto.init());
