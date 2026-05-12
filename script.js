let datosGlobales = [];
let presupuestoActual = 50;
let continenteActual = "Todos";
let audioCtx;
let oscInterval;

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
  // 1. Filtrar por continente
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

  // 3. Ordenar de menor a mayor para una mejor jerarquía visual
  datosCalculados.sort((a, b) => a.kmDinamico - b.kmDinamico);

  crearGrafico(datosCalculados);
}

function crearGrafico(datos) {
  const paises = datos.map(d => d["País"]);
  const kmReal = datos.map(d => d.kmDinamico);
  const colores = datos.map(d => coloresContinente[d["Continente"]] || "#64748b");
  const maxKm = Math.max(...kmReal, 1); 

  // Generar los objetos de imagen para cada barra (Anclados a cada País)
  const imagenesAutos = datos.map(d => {
    const modelo = d["Sedán Más Vendido (Combustión)"];
    
    // Transformar "Nissan Versa" a "nissan_versa" para coincidir con tus archivos
    let nombreArchivo = modelo.toLowerCase().trim().replace(/\s+/g, '_');
    
    return {
      source: `img/autos/${nombreArchivo}.png`, 
      xref: "x",
      yref: "y",
      x: d.kmDinamico + (maxKm * 0.01), 
      y: d["País"],
      sizex: maxKm * 0.08, 
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

  const traceKm = {
    // Aumentamos el desplazamiento (0.12) para que el texto aparezca después del auto
    x: kmReal.map(v => v + (maxKm * 0.12)), 
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
    // Aumentamos el margen derecho para evitar que las etiquetas se corten
    margin: { t: 30, r: 150, b: 50, l: 150 }, 
    showlegend: false,
    height: Math.max(400, datos.length * 40), 
    bargap: 0.15,
    plot_bgcolor: "white",
    paper_bgcolor: "white",
    images: imagenesAutos // Inyección de las imágenes en el layout
  };

  Plotly.newPlot("graficoBarras", [traceBarras, traceKm], layout, { responsive: true, displayModeBar: false });

  // 4. Sonificación por clic en Plotly
  document.getElementById("graficoBarras").removeAllListeners('plotly_click');
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