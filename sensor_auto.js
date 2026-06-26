// ============================================================
//  sensor_auto.js  —  Modo Auto (teléfono como sensor)
//  Bencina y Autos · proyecto de visualización
//
//  QUÉ HACE:
//   - Lee la INCLINACIÓN del teléfono (giroscopio / orientación).
//   - Al inclinar el auto hacia adelante, "avanza" y todas las
//     barras del gráfico crecen desde 0 hacia su límite.
//   - Cuando un país llega a su límite de presupuesto, congela su
//     barra y lo anuncia por voz: "Se acabó el presupuesto de ...".
//   - Emite sonido de motor mientras el auto se mueve, y un pitido
//     por cada país agotado: tono más agudo = bencina más cara,
//     ritmo más rápido = auto más ineficiente (menos km/l).
//
//  REQUISITOS:
//   - Abrir la página en el TELÉFONO sobre HTTPS (GitHub Pages sirve).
//   - Tocar el botón "Iniciar modo auto" (iOS pide permiso del sensor
//     y los navegadores exigen un toque para activar el sonido).
//
//  Este módulo depende de funciones que expone script.js a través
//  del objeto global  window.App  (ver script.js).
// ============================================================

const SensorAuto = (() => {

  // ---- Parámetros de calibración (ajustables) ----------------
  const ZONA_MUERTA_GRADOS = 6;     // inclinación mínima para empezar a avanzar
  const INCLINACION_MAX     = 35;   // grados de inclinación = velocidad máxima
  const SEG_RECORRIDO_TOTAL = 6;    // segundos en cruzar todo el gráfico a tope
  let   invertirDireccion   = false;// por si el adelante/atrás queda al revés

  // ---- Estado interno ----------------------------------------
  let activo      = false;
  let betaRef     = null;   // ángulo "plano" de referencia (calibrado al iniciar)
  let betaActual  = null;   // último ángulo leído
  let ultimoT     = 0;      // timestamp para integrar
  let rafId       = null;

  // ---- Audio --------------------------------------------------
  let ctx         = null;
  let motorOsc    = null;
  let motorGain   = null;
  let motorFiltro = null;

  // ============================================================
  //  INICIALIZACIÓN  — engancha el botón
  // ============================================================
  function init() {
    const btn = document.getElementById("btnModoAuto");
    if (btn) btn.addEventListener("click", alternar);

    const chk = document.getElementById("chkInvertir");
    if (chk) chk.addEventListener("change", e => { invertirDireccion = e.target.checked; });

    // Soporte de teclado para PROBAR en el computador (sin teléfono):
    // Flecha arriba = avanzar, Flecha abajo = retroceder.
    window.addEventListener("keydown", (e) => {
      if (!activo) return;
      if (e.key === "ArrowUp")   { App.avanzar(App.getMaxKm() * 0.04); revMotorMomentaneo(); }
      if (e.key === "ArrowDown") { App.avanzar(-App.getMaxKm() * 0.04); }
    });
  }

  // ============================================================
  //  INICIAR / DETENER
  // ============================================================
  async function alternar() {
    if (activo) { detener(); return; }
    await iniciar();
  }

  async function iniciar() {
    iniciarAudio();

    // Pedir permiso del sensor (obligatorio en iOS 13+)
    const permiso = await pedirPermisoSensor();
    if (permiso === "denegado") {
      setEstado("Permiso del sensor denegado. Puedes usar las flechas ↑ ↓ del teclado para probar.");
    } else if (permiso === "no-soportado") {
      setEstado("Este dispositivo no entrega sensores de movimiento. Usa las flechas ↑ ↓ para probar.");
    } else {
      window.addEventListener("deviceorientation", onOrientacion, true);
      setEstado("Inclina el auto hacia ADELANTE para avanzar · plano para frenar.");
    }

    // Reiniciar el recorrido
    betaRef    = null;
    activo     = true;
    ultimoT    = 0;
    App.reiniciar();        // pone todas las barras en 0 y limpia agotados
    App.setModoAuto(true);

    const btn = document.getElementById("btnModoAuto");
    if (btn) { btn.textContent = "■ Detener modo auto"; btn.classList.add("activo"); }

    rafId = requestAnimationFrame(bucle);
  }

  function detener() {
    activo = false;
    window.removeEventListener("deviceorientation", onOrientacion, true);
    if (rafId) cancelAnimationFrame(rafId);
    pararMotor();
    App.setModoAuto(false);

    const btn = document.getElementById("btnModoAuto");
    if (btn) { btn.textContent = "▶ Iniciar modo auto"; btn.classList.remove("activo"); }
    setEstado("Modo auto detenido.");
  }

  // ============================================================
  //  PERMISO DEL SENSOR
  // ============================================================
  async function pedirPermisoSensor() {
    if (typeof DeviceOrientationEvent === "undefined") return "no-soportado";
    // iOS 13+ requiere pedir permiso explícito con un gesto del usuario
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        const r = await DeviceOrientationEvent.requestPermission();
        return r === "granted" ? "ok" : "denegado";
      } catch (_) {
        return "denegado";
      }
    }
    return "ok"; // Android y otros no requieren permiso explícito
  }

  // ============================================================
  //  LECTURA DEL SENSOR
  //  beta = inclinación adelante/atrás del teléfono (en grados)
  // ============================================================
  function onOrientacion(e) {
    if (e.beta === null || e.beta === undefined) return;
    betaActual = e.beta;
    if (betaRef === null) betaRef = e.beta; // calibrar: la posición inicial = "plano"
  }

  // ============================================================
  //  BUCLE PRINCIPAL  (integra la inclinación → avance)
  // ============================================================
  function bucle(t) {
    if (!activo) return;

    if (ultimoT === 0) ultimoT = t;
    const dt = Math.min((t - ultimoT) / 1000, 0.1); // segundos (limitado)
    ultimoT = t;

    let factor = 0; // -1 .. 1  (qué tan rápido y en qué dirección avanza)

    if (betaActual !== null && betaRef !== null) {
      let inclinacion = betaActual - betaRef;            // grados respecto al inicio
      if (invertirDireccion) inclinacion = -inclinacion;

      if (Math.abs(inclinacion) > ZONA_MUERTA_GRADOS) {
        const signo = Math.sign(inclinacion);
        const mag   = Math.min(Math.abs(inclinacion), INCLINACION_MAX) / INCLINACION_MAX;
        factor = signo * mag;
      }
    }

    // Velocidad relativa al tamaño del gráfico (cruza todo a tope en SEG_RECORRIDO_TOTAL)
    const velocidad = factor * (App.getMaxKm() / SEG_RECORRIDO_TOTAL);
    if (velocidad !== 0) App.avanzar(velocidad * dt);

    // Sonido del motor según la velocidad y el progreso
    actualizarMotor(Math.abs(factor), App.getProgreso());

    rafId = requestAnimationFrame(bucle);
  }

  // ============================================================
  //  AUDIO: MOTOR CONTINUO
  // ============================================================
  function iniciarAudio() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();

    if (!motorOsc) {
      motorOsc    = ctx.createOscillator();
      motorGain   = ctx.createGain();
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
    // Frecuencia del motor: sube con la velocidad y un poco con el progreso
    const freq = 55 + velocidad01 * 130 + progreso01 * 50;
    motorOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
    // Volumen: 0 cuando está detenido, audible cuando se mueve
    const vol = velocidad01 > 0.02 ? 0.07 : 0.0;
    motorGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
  }

  function revMotorMomentaneo() {
    // Pequeño acelerón para el modo teclado (sin sensor)
    if (!ctx || !motorGain) return;
    motorGain.gain.setTargetAtTime(0.07, ctx.currentTime, 0.02);
    motorGain.gain.setTargetAtTime(0.0,  ctx.currentTime + 0.15, 0.1);
  }

  function pararMotor() {
    if (motorGain && ctx) motorGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  }

  // ============================================================
  //  AVISO CUANDO UN PAÍS SE QUEDA SIN PRESUPUESTO
  //  Llamado desde script.js (App) en el momento exacto.
  //  - tono (pitch): más AGUDO si la bencina es más CARA
  //  - ritmo: más RÁPIDO si el auto es más INEFICIENTE (menos km/l)
  // ============================================================
  function anunciarAgotado(pais, precio, consumo) {
    if (!ctx) iniciarAudio();
    const r = App.getRangos();

    // Tono según precio
    const freq = mapear(precio, r.minPrecio, r.maxPrecio, 220, 1000);
    // Intervalo entre pulsos según consumo (poco km/l = pulsos rápidos)
    const intervalo = mapear(consumo, r.minConsumo, r.maxConsumo, 90, 260); // ms
    const pulsos = 4;

    for (let i = 0; i < pulsos; i++) {
      setTimeout(() => pitido(freq), i * intervalo);
    }
    // Voz justo después de los pulsos
    setTimeout(() => hablar(`Se acabó el presupuesto de ${pais}`), pulsos * intervalo + 80);
  }

  function pitido(freq) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.12);
  }

  // ============================================================
  //  VOZ (síntesis de voz del navegador)
  // ============================================================
  function hablar(texto) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "es-ES";
    u.rate = 1.05;
    // Intentar una voz en español si existe
    const voces = window.speechSynthesis.getVoices();
    const vozEs = voces.find(v => v.lang && v.lang.toLowerCase().startsWith("es"));
    if (vozEs) u.voice = vozEs;
    window.speechSynthesis.speak(u);
  }

  // ============================================================
  //  AVISO FINAL (todos agotados)
  // ============================================================
  function anunciarFin() {
    pararMotor();
    setTimeout(() => hablar("Todos los países llegaron a su límite de presupuesto"), 200);
    setEstado("✅ Todos los países llegaron a su límite. Toca 'Detener' o reinicia.");
  }

  // ---- utilidades --------------------------------------------
  function mapear(v, inMin, inMax, outMin, outMax) {
    const t = Math.max(0, Math.min(1, (v - inMin) / (inMax - inMin || 1)));
    return outMin + t * (outMax - outMin);
  }

  function setEstado(txt) {
    const el = document.getElementById("estadoModoAuto");
    if (el) el.textContent = txt;
  }

  // API pública (script.js llama a anunciarAgotado / anunciarFin)
  return { init, anunciarAgotado, anunciarFin };

})();

// Cargar las voces de síntesis (algunas navegadores las cargan async)
if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {};
}

document.addEventListener("DOMContentLoaded", () => SensorAuto.init());
