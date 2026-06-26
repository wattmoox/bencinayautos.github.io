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

  // ---- Sensibilidad del MOVIMIENTO (ajustable) ----
  // Si el gráfico avanza demasiado rápido al empujar, BAJA SENSIBILIDAD.
  // Si avanza muy poco, SÚBELA.
  const SENSIBILIDAD = 0.15;   // cuánto avanza el gráfico por empuje
  const FRICCION     = 0.88;   // frena el "rodado" cuando el auto se detiene (0–1)
  const UMBRAL_ACC   = 0.5;    // ignora vibraciones pequeñas (m/s²)
  const UMBRAL_VEL   = 0.05;   // por debajo de esto, se considera detenido
  let   invertirDireccion = false;

  // ---- Estado ----
  let activo = false;
  let accActual = 0;      // última aceleración (movimiento) recibida del teléfono
  let velocidad = 0;      // velocidad "virtual" integrada (con fricción)
  let ultimoT = 0;
  let rafId = null;

  // ---- Audio ----
  let ctx = null, motorOsc = null, motorGain = null, motorFiltro = null;

  // ---- Conexión (PeerJS) ----
  let peer = null, conn = null, codigo = null, timeoutConexion = null;

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
    prepararVoz();                  // "despierta" la síntesis de voz (gesto del usuario)
    accActual = 0; velocidad = 0;
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
    mostrarPanelVacio(); // mostrar el panel de inmediato con "generando…"

    if (typeof Peer === "undefined") {
      const codEl = document.getElementById("codigoConexion");
      if (codEl) codEl.textContent = "(sin conexión)";
      setEstado("⚠️ No se cargó la librería de conexión (PeerJS). Revisa tu internet o que la red no bloquee unpkg.com. Mientras tanto puedes probar con las flechas ↑ ↓.");
      return;
    }

    codigo = nuevoCodigo();
    crearPeer(0);

    // Si en 8 segundos no se conecta al servidor de emparejamiento, avisar
    clearTimeout(timeoutConexion);
    timeoutConexion = setTimeout(() => {
      if (!peer || !peer.open) {
        const codEl = document.getElementById("codigoConexion");
        if (codEl) codEl.textContent = "(sin conexión)";
        setEstado("⏳ No se pudo conectar al servidor de emparejamiento. Verifica tu internet (prueba con datos móviles o cambia de red). Para la demo también puedes usar las flechas ↑ ↓.");
      }
    }, 8000);
  }

  function mostrarPanelVacio() {
    const panel = document.getElementById("panelConexion");
    const codEl = document.getElementById("codigoConexion");
    const qrEl  = document.getElementById("qrConexion");
    if (codEl) codEl.textContent = "generando…";
    if (qrEl)  qrEl.innerHTML = "";
    if (panel) panel.style.display = "flex";
    setEstado("Generando código de conexión…");
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

    peer.on("open", () => { clearTimeout(timeoutConexion); mostrarPanel(); });

    peer.on("error", (err) => {
      const tipo = err && err.type ? err.type : "?";
      // Si el código ya está en uso, generamos otro
      if (tipo === "unavailable-id" && intento < 3) {
        codigo = nuevoCodigo();
        crearPeer(intento + 1);
      } else {
        clearTimeout(timeoutConexion);
        const codEl = document.getElementById("codigoConexion");
        if (codEl) codEl.textContent = "(error)";
        setEstado("Problema de conexión (" + tipo + "). Reintenta con 'Detener' e 'Iniciar', cambia de red, o usa las flechas ↑ ↓.");
      }
    });

    peer.on("connection", (c) => {
      conn = c;
      conn.on("open", () => {
        accActual = 0; velocidad = 0;
        App.reiniciar();
        setEstado("📱 Teléfono conectado. Empuja el auto hacia ADELANTE para avanzar.");
      });
      conn.on("data", (d) => {
        if (d && typeof d.acc === "number") accActual = d.acc;
      });
      conn.on("close", () => {
        accActual = 0; velocidad = 0;
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

    // Integrar la aceleración del auto en una "velocidad" con fricción.
    // Empujar el auto = aceleración → el gráfico avanza; al detenerse, frena.
    velocidad = velocidad * FRICCION + accActual * dt;
    if (Math.abs(accActual) < UMBRAL_ACC && Math.abs(velocidad) < UMBRAL_VEL) velocidad = 0;

    const dir = invertirDireccion ? -1 : 1;
    const deltaKm = dir * velocidad * App.getMaxKm() * SENSIBILIDAD * dt;
    if (deltaKm !== 0) App.avanzar(deltaKm);

    // Sonido del motor según la velocidad del auto
    const velNorm = Math.min(Math.abs(velocidad) / 1.2, 1);
    actualizarMotor(velNorm, App.getProgreso());

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

  // "Despierta" la síntesis de voz dentro del gesto del usuario (clic en Iniciar).
  // Sin esto, muchos navegadores ignoran el primer speak() que ocurre después.
  function prepararVoz() {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      window.speechSynthesis.getVoices(); // fuerza la carga de voces
      const warm = new SpeechSynthesisUtterance(" ");
      warm.volume = 0;
      window.speechSynthesis.speak(warm);
    } catch (e) {}
  }

  function hablar(texto) {
    if (!("speechSynthesis" in window)) return;
    try { window.speechSynthesis.resume(); } catch (e) {}
    const u = new SpeechSynthesisUtterance(texto);
    u.rate = 1.05;
    const voces = window.speechSynthesis.getVoices();
    const vozEs = voces.find(v => v.lang && v.lang.toLowerCase().startsWith("es"));
    if (vozEs) { u.voice = vozEs; u.lang = vozEs.lang; }
    else { u.lang = "es-ES"; }
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
