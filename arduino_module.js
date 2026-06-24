// Fisicalización + Sonificación

const ArduinoFisico = (() => {

  // Config 
  const BRIDGE_URL = "http://localhost:5000"; // servidor arduino_bridge.py

  // Rango de precios reales del dataset (no modificar sin actualizar datos)
  const MIN_PRECIO = 1.008;  // Bolivia
  const MAX_PRECIO = 4.135;  // Hong Kong

  // Estado de audio 
  let audioCtx = null;
  let motorOsc = null;
  let motorGain = null;

  // Utilidad de mapeo lineal 
  function mapear(valor, entMin, entMax, salMin, salMax) {
    const t = Math.max(0, Math.min(1, (valor - entMin) / (entMax - entMin || 1)));
    return Math.round(salMin + t * (salMax - salMin));
  }

  //  CÁLCULO DE PARÁMETROS
  //  Recibe los km dinámicos (cambian con el slider de presupuesto)
  //  y el precio por litro del país seleccionado.
  function calcularConfig(km, maxKm, precio) {
    // Distancia física en la mesa: 8 cm (país caro) → 120 cm (país barato)
    const distance = mapear(km, 0, maxKm, 8, 120);

    // Velocidad del motor: más km = rueda más rápido
    const speed = mapear(km, 0, maxKm, 60, 230);

    // Frecuencia del buzzer: precio barato = tono grave, precio caro = tono agudo
    const freq = precio
      ? mapear(precio, MIN_PRECIO, MAX_PRECIO, 110, 950)
      : 440;

    return { distance, speed, freq };
  }

  //  SONIFICACIÓN WEB (Audio API del navegador)
  //  Emite un tono continuo tipo "motor" mientras dura el movimiento.
  //  Complementa el ritmo de clics que ya tenía la página.
  function iniciarSonidoMotor(freq, duracion_ms) {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    pararSonidoMotor();

    motorOsc  = audioCtx.createOscillator();
    motorGain = audioCtx.createGain();

    motorOsc.type = "sawtooth"; // timbre de motor
    motorOsc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    motorGain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    // Fade-out suave al final del recorrido
    motorGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duracion_ms / 1000);

    motorOsc.connect(motorGain);
    motorGain.connect(audioCtx.destination);
    motorOsc.start();
    motorOsc.stop(audioCtx.currentTime + duracion_ms / 1000);
    motorOsc.onended = pararSonidoMotor;
  }

  function pararSonidoMotor() {
    try { if (motorOsc) { motorOsc.disconnect(); motorOsc.stop(); } } catch(_) {}
    motorOsc = null;
  }

  //  ENVIAR COMANDO AL ARDUINO
  async function enviarAlArduino(config) {
    try {
      const resp = await fetch(`${BRIDGE_URL}/move`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(config),
        signal:  AbortSignal.timeout(2000) // no bloquear la UI si no hay bridge
      });
      const data = await resp.json();
      console.log("[Arduino] →", data.response);
    } catch (_) {
      // Bridge no activo: solo corre el sonido web
    }
  }

  //  INDICADOR VISUAL  (widget flotante en la esquina)
  function mostrarIndicador(pais, config, km, duracion_ms) {
    let el = document.getElementById("arduino-indicador");
    if (!el) {
      el = document.createElement("div");
      el.id = "arduino-indicador";
      el.style.cssText = [
        "position:fixed", "bottom:20px", "right:20px",
        "background:rgba(0,0,0,0.88)", "color:#fff",
        "padding:14px 18px", "border-radius:12px",
        "font-family:monospace", "font-size:13px",
        "z-index:9999", "box-shadow:0 4px 18px rgba(0,0,0,0.45)",
        "transition:opacity 0.6s", "min-width:230px", "line-height:1.6"
      ].join(";");
      document.body.appendChild(el);
    }

    const pct       = Math.round((config.distance / 120) * 100);
    const velPct    = Math.round((config.speed / 230) * 100);
    const segs      = (duracion_ms / 1000).toFixed(1);

    el.style.opacity = "1";
    el.innerHTML = `
      <div style="font-size:15px;margin-bottom:6px;">🚗 Auto en movimiento</div>
      <div><b>${pais}</b> · ${km.toFixed(0)} km</div>
      <div style="margin:6px 0 2px;">
        <span style="font-size:11px;color:#aaa;">Distancia en mesa</span>
        <div style="background:#333;border-radius:4px;height:7px;margin-top:3px;">
          <div style="background:#4CAF50;width:${pct}%;height:100%;border-radius:4px;"></div>
        </div>
        <span style="font-size:11px;">${config.distance} cm</span>
      </div>
      <div>Velocidad: <b>${velPct}%</b> · Tono: <b>${config.freq} Hz</b></div>
      <div style="color:#f0c040;margin-top:4px;">⏱ ~${segs}s de recorrido</div>
    `;

    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => { el.style.opacity = "0"; }, duracion_ms + 1200);
  }

  //  FUNCIÓN PRINCIPAL  — llamada desde script.js
  async function reproducirDesdeKm(km, maxKm, precio, pais) {
    const config = calcularConfig(km, maxKm, precio);

    // Duración estimada del recorrido (sincroniza sonido y UI)
    // Velocidad real aproximada: a speed=230 PWM el auto va ~20 cm/s
    const cmPorSegundo = (config.speed / 230) * 20;
    const duracion_ms  = Math.round((config.distance / cmPorSegundo) * 1000);

    console.log(
      `[Arduino] ${pais} | ${km.toFixed(0)} km | ` +
      `dist:${config.distance}cm | vel:${config.speed} | ` +
      `freq:${config.freq}Hz | dur:${duracion_ms}ms`
    );

    // 1. Sonido web continuo (funciona siempre)
    iniciarSonidoMotor(config.freq, duracion_ms);

    // 2. Movimiento físico (si el bridge está activo)
    await enviarAlArduino(config);

    // 3. Indicador visual
    mostrarIndicador(pais, config, km, duracion_ms);
  }

  //  INIT  — verificar conexión al inicio
  async function init() {
    try {
      const resp = await fetch(`${BRIDGE_URL}/status`, { signal: AbortSignal.timeout(1500) });
      const data = await resp.json();
      const estado = data.connected ? "✅ Arduino conectado" : "⚠️ Bridge activo, Arduino desconectado";
      console.log(`[Arduino] ${estado}`);
    } catch (_) {
      console.info("[Arduino] Bridge no activo — solo sonificación web.");
    }
  }

  // API pública
  return { init, reproducirDesdeKm, pararSonidoMotor };

})();