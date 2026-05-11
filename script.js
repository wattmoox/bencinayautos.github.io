let datosGlobales = [];
let presupuestoActual = 50;
let continenteActual = "Todos";
let audioCtx;
let oscInterval;

// Colores asignados a cada continente
const coloresContinente = {
  "América": "#31ED31",
  "Europa": "#31ED8F",
  "Asia": "#31EDED",
  "África": "#ED31ED",
  "Oceanía": "#ED3131"
};

// Carga inicial
fetch("datos/datos_a_utilizar.json?v=11")
  .then(response => {
    if (!response.ok) throw new Error("No se pudo cargar el archivo");
    return response.json();
  })
  .then(data => {
    // Validar que existan los datos necesarios
    datosGlobales = data.filter(d =>
      d["País"] &&
      d["Continente"] &&
      d["Sedán Más Vendido (Combustión)"] &&
      d["Precio Aprox. Litro Gasolina (USD)"] &&
      d["Consumo Mixto Aprox."]
    );

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
    actualizarVisualizacion();
  });

  filtroCont.addEventListener("change", (e) => {
    continenteActual = e.target.value;
    actualizarVisualizacion();
  });
}

function actualizarVisualizacion() {
  // 1. Filtrar
  let datosFiltrados = datosGlobales;
  if (continenteActual !== "Todos") {
    datosFiltrados = datosGlobales.filter(d => d["Continente"] === continenteActual);
  }

  // 2. Recalcular Kilómetros en base al presupuesto dinámico
  // Fórmula: (Presupuesto / Precio Bencina) * Consumo Vehículo
  const datosCalculados = datosFiltrados.map(d => {
    const precio = Number(d["Precio Aprox. Litro Gasolina (USD)"]);
    const consumo = Number(d["Consumo Mixto Aprox."]);
    const km = (presupuestoActual / precio) * consumo;
    return { ...d, kmDinamico: km };
  });

  // 3. Ordenar de menor a mayor para que Plotly los dibuje bien
  datosCalculados.sort((a, b) => a.kmDinamico - b.kmDinamico);

  crearGrafico(datosCalculados);
}

function crearGrafico(datos) {
  const paises = datos.map(d => d["País"]);
  const kmReal = datos.map(d => d.kmDinamico);
  const colores = datos.map(d => coloresContinente[d["Continente"]] || "#64748b");
  const maxKm = Math.max(...kmReal, 1); // Evitar división por cero

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

  const traceKm = {
    x: kmReal.map(v => v + (maxKm * 0.05)), // Espaciado dinámico
    y: paises,
    mode: "text",
    text: kmReal.map(v => `${v.toFixed(1)} km`),
    textposition: "middle right",
    textfont: { color: "#1f2937", size: 13 },
    hoverinfo: "skip",
    showlegend: false
  };

  const layout = {
    xaxis: { showgrid: true, showticklabels: true, zeroline: true, rangemode: 'tozero' },
    yaxis: { automargin: true, tickfont: { size: 13 } },
    margin: { t: 30, r: 80, b: 50, l: 150 },
    showlegend: false,
    height: Math.max(400, datos.length * 40), // Altura dinámica según cantidad de barras
    bargap: 0.15,
    plot_bgcolor: "white",
    paper_bgcolor: "white",
  };

  Plotly.newPlot("graficoBarras", [traceBarras, traceKm], layout, { responsive: true, displayModeBar: false });

  // 4. Agregar Sonificación por clic en Plotly
  document.getElementById("graficoBarras").removeAllListeners('plotly_click'); // Evitar duplicados
  document.getElementById("graficoBarras").on('plotly_click', function(data){
    const kms = data.points[0].x;
    const minKm = Math.min(...kmReal);
    reproducirSonificacion(kms, minKm, maxKm);
  });
}

// ==============================
// MOTOR DE SONIFICACIÓN (Ritmo)
// ==============================
function reproducirSonificacion(kmClick, minKm, maxKm) {
  // Inicializar contexto de audio si no existe (Requiere interacción del usuario)
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  if(oscInterval) clearInterval(oscInterval); // Detener sonido anterior si existe

  // Mapear Kilometros a un intervalo de tiempo (Ritmo)
  // Menos KM = Más lento (ej. 700ms entre clics)
  // Más KM = Más rápido (ej. 100ms entre clics)
  let ratio = (kmClick - minKm) / (maxKm - minKm || 1);
  let intervaloMs = 700 - (ratio * 600); 

  let contador = 0;
  // Sonar un "clic" constante según el ritmo calculado durante 15 pulsos
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
  
  osc.type = 'triangle'; // Tono tipo motor mecánico suave
  osc.frequency.value = 150; 
  
  // Envolvente de volumen corta (tipo percusión/clic)
  gain.gain.setValueAtTime(1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
  
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.1);
}