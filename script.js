let datosGlobales = [];
let presupuestoActual = 50;
let continenteActual = "Todos";
let audioCtx;
let oscInterval;
let maxKmGlobal = 0; // Variable para fijar el eje X (a presupuesto 100)

// ===== Estado del MODO AUTO (teléfono como sensor) =====
let modoAuto      = false;   // true mientras se controla con el auto/teléfono
let avanceKm      = 0;       // "kilómetros recorridos" globales según el avance del auto
let maxKmActual   = 1;       // mayor límite entre los países mostrados (con el presupuesto actual)
let datosOrdenados = [];     // datos ordenados (orden FIJO durante el llenado)
let agotados      = new Set();// países que ya llegaron a su límite
let finAnunciado  = false;   // evita repetir el aviso "todos agotados"
let rangos        = { minPrecio: 1, maxPrecio: 4, minConsumo: 10, maxConsumo: 22 };
let clickEnlazado = false;   // para enlazar el clic de sonificación una sola vez
let ultimoDibujo  = 0;       // throttle del redibujo en modo auto

// Colores asignados a cada continente (Paleta conceptual recomendada)
const coloresContinente = {
  "América": "#2A9D8F",
  "Europa": "#1D3557",
  "Asia": "#E63946",
  "África": "#F4A261",
  "Oceanía": "#00B4D8"
};

// Carga inicial
fetch("datos/datos_a_utilizar.json?v=11")
  .then(response => {
    if (!response.ok) throw new Error("No se pudo cargar el archivo");
    return response.json();
  })
  .then(data => {
    // Validar que existan los datos necesarios para el análisis
    datosGlobales = data.filter(d =>
      d["País"] &&
      d["Continente"] &&
      d["Sedán Más Vendido (Combustión)"] &&
      d["Precio Aprox. Litro Gasolina (USD)"] &&
      d["Consumo Mixto Aprox."]
    );

    // Calcular el límite fijo del eje X (presupuesto máximo de 100 USD)
    const presupuestoMaximo = 100;
    maxKmGlobal = Math.max(...datosGlobales.map(d => {
      return (presupuestoMaximo / Number(d["Precio Aprox. Litro Gasolina (USD)"])) * Number(d["Consumo Mixto Aprox."]);
    }));

    // Rangos de precio y consumo (para mapear el sonido en el modo auto)
    const precios  = datosGlobales.map(d => Number(d["Precio Aprox. Litro Gasolina (USD)"]));
    const consumos = datosGlobales.map(d => Number(d["Consumo Mixto Aprox."]));
    rangos = {
      minPrecio:  Math.min(...precios),
      maxPrecio:  Math.max(...precios),
      minConsumo: Math.min(...consumos),
      maxConsumo: Math.max(...consumos)
    };

    configurarControles();
    actualizarVisualizacion();
  })
  .catch(error => {
    document.getElementById("graficoBarras").innerHTML = `<div class="error">${error.message}</div>`;
  });

function configurarControles() {
  const slider = document.getElementById("presupuestoSlider");
  const valorPresupuestoText = document.getElementById("valorPresupuesto");
  const filtroCont = document.getElementById("continenteFilter");

  slider.addEventListener("input", (e) => {
    presupuestoActual = Number(e.target.value);
    valorPresupuestoText.innerText = `$${presupuestoActual}`;
    document.getElementById("tituloGrafico").innerText = `Kilómetros recorridos con ${presupuestoActual} USD`;
    if (modoAuto) { avanceKm = 0; agotados.clear(); finAnunciado = false; } // cambiar el límite reinicia el recorrido
    actualizarVisualizacion();
  });

  filtroCont.addEventListener("change", (e) => {
    continenteActual = e.target.value;
    if (modoAuto) { avanceKm = 0; agotados.clear(); finAnunciado = false; }
    actualizarVisualizacion();
  });
}

function actualizarVisualizacion() {
  // 1. Filtrar por continente
  let datosFiltrados = datosGlobales;
  if (continenteActual !== "Todos") {
    datosFiltrados = datosGlobales.filter(d => d["Continente"] === continenteActual);
  }

  // 2. Calcular el LÍMITE de km de cada país según el presupuesto (límite del usuario)
  const datosCalculados = datosFiltrados.map(d => {
    const precio = Number(d["Precio Aprox. Litro Gasolina (USD)"]);
    const consumo = Number(d["Consumo Mixto Aprox."]);
    const kmMax = (presupuestoActual / precio) * consumo;
    return { ...d, kmMax: kmMax };
  });

  // 3. Ordenar por el LÍMITE (orden estable: no se reordena mientras se llena)
  datosCalculados.sort((a, b) => a.kmMax - b.kmMax);

  datosOrdenados = datosCalculados;
  maxKmActual = Math.max(...datosCalculados.map(d => d.kmMax), 1);

  dibujar(true);
}

// Dibuja el gráfico. En modo auto, cada barra muestra min(avance, su límite).
function dibujar(animar) {
  const datos = datosOrdenados.map(d => {
    const mostrado = modoAuto ? Math.min(avanceKm, d.kmMax) : d.kmMax;
    return { ...d, kmDinamico: mostrado };
  });
  crearGrafico(datos, animar);
}

function crearGrafico(datos, animar) {
  const paises = datos.map(d => d["País"]);
  const kmReal = datos.map(d => d.kmDinamico);
  const colores = datos.map(d => {
    // Los países agotados se muestran apagados (gris) para indicar "sin presupuesto"
    if (modoAuto && agotados.has(d["País"])) return "#9aa0a6";
    return coloresContinente[d["Continente"]] || "#64748b";
  });

  // Generar los objetos de imagen usando maxKmGlobal para mantener tamaño consistente
  const imagenesAutos = datos.map(d => {
    const modelo = d["Sedán Más Vendido (Combustión)"];
    let nombreArchivo = modelo.toLowerCase().trim().replace(/\s+/g, '_');

    return {
      source: `img/autos/${nombreArchivo}.png`,
      xref: "x",
      yref: "y",
      x: d.kmDinamico + (maxKmGlobal * 0.01),
      y: d["País"],
      sizex: maxKmGlobal * 0.08,
      sizey: 0.8,
      xanchor: "left",
      yanchor: "middle"
    };
  });

  const traceBarras = {
    x: kmReal,
    y: paises,
    orientation: "h",
    type: "bar",
    marker: { color: colores },
    hovertemplate:
      "<b>%{y}</b><br>" +
      "Modelo: %{customdata[0]}<br>" +
      "Rendimiento: %{x:.1f} km<br>" +
      "<extra></extra>",
    customdata: datos.map(d => [d["Sedán Más Vendido (Combustión)"]])
  };

  // Texto a la derecha de cada barra. Si está agotado se agrega un candado.
  const traceKm = {
    x: kmReal.map(v => v + (maxKmGlobal * 0.12)), // Espaciado fijo del texto
    y: paises,
    mode: "text",
    text: datos.map(d => {
      const etiqueta = `${d.kmDinamico.toFixed(1)} km`;
      return (modoAuto && agotados.has(d["País"])) ? `${etiqueta} 🔒` : etiqueta;
    }),
    textposition: "middle right",
    textfont: { color: "#1f2937", size: 13 },
    hoverinfo: "skip",
    showlegend: false
  };

  const layout = {
    xaxis: {
      showgrid: true,
      showticklabels: true,
      zeroline: true,
      rangemode: 'tozero',
      range: [0, maxKmGlobal * 1.2] // Eje X fijo
    },
    yaxis: { automargin: true, tickfont: { size: 13 } },
    margin: { t: 30, r: 150, b: 50, l: 150 },
    showlegend: false,
    height: Math.max(400, datos.length * 40),
    bargap: 0.15,
    plot_bgcolor: "white",
    paper_bgcolor: "white",
    images: imagenesAutos,
    transition: {
      duration: animar ? 500 : 0,           // sin animación durante el llenado (más fluido)
      easing: 'cubic-in-out'
    }
  };

  Plotly.react("graficoBarras", [traceBarras, traceKm], layout, { responsive: true, displayModeBar: false });

  // Sonificación por clic (se enlaza una sola vez)
  if (!clickEnlazado) {
    const graficoDiv = document.getElementById("graficoBarras");
    graficoDiv.on('plotly_click', function(data){
      const kms = data.points[0].x;
      reproducirSonificacion(kms, 0, maxKmGlobal);
    });
    clickEnlazado = true;
  }
}

// ============================================================
//  App  —  puente con sensor_auto.js (modo auto)
// ============================================================
window.App = {
  // El sensor llama esto para hacer avanzar (o retroceder) el recorrido
  avanzar(deltaKm) {
    avanceKm = Math.max(0, Math.min(avanceKm + deltaKm, maxKmActual));
    revisarAgotados();
    // Redibujar con throttle (~12 veces por segundo) para no sobrecargar
    const ahora = performance.now();
    if (ahora - ultimoDibujo > 80) {
      ultimoDibujo = ahora;
      dibujar(false);
    }
  },

  reiniciar() {
    avanceKm = 0;
    agotados.clear();
    finAnunciado = false;
    dibujar(false);
  },

  setModoAuto(v) {
    modoAuto = v;
    dibujar(true);
  },

  getMaxKm()    { return maxKmActual; },
  getProgreso() { return maxKmActual ? (avanceKm / maxKmActual) : 0; },
  getRangos()   { return rangos; }
};

// Detecta qué países acaban de llegar a su límite y avisa al módulo de sonido
function revisarAgotados() {
  for (const d of datosOrdenados) {
    if (avanceKm >= d.kmMax && !agotados.has(d["País"])) {
      agotados.add(d["País"]);
      if (window.SensorAuto && SensorAuto.anunciarAgotado) {
        SensorAuto.anunciarAgotado(
          d["País"],
          Number(d["Precio Aprox. Litro Gasolina (USD)"]),
          Number(d["Consumo Mixto Aprox."])
        );
      }
    }
  }
  // ¿Todos agotados? (solo se anuncia una vez)
  if (!finAnunciado && agotados.size === datosOrdenados.length && datosOrdenados.length > 0) {
    finAnunciado = true;
    if (window.SensorAuto && SensorAuto.anunciarFin) SensorAuto.anunciarFin();
  }
}

// ==============================
// MOTOR DE SONIFICACIÓN (Ritmo) — clic en una barra (se mantiene)
// ==============================
function reproducirSonificacion(kmClick, minKm, maxKm) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  if(oscInterval) clearInterval(oscInterval);

  let ratio = (kmClick - minKm) / (maxKm - minKm || 1);
  let intervaloMs = 700 - (ratio * 600);

  let contador = 0;
  oscInterval = setInterval(() => {
    generarSonidoClic();
    contador++;
    if(contador > 15) clearInterval(oscInterval);
  }, intervaloMs);
}

function generarSonidoClic() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.type = 'triangle';
  osc.frequency.value = 150;

  gain.gain.setValueAtTime(1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.1);
}
