let datosGlobales = [];
let presupuestoActual = 50;
let continenteActual = "Todos";
let audioCtx;
let oscInterval;
let maxKmGlobal = 0; // Variable para fijar el eje X

// Paleta Okabe-Ito (100% segura para daltónicos)
const coloresContinente = {
  "América": "#56B4E9", // Celeste claro
  "Europa": "#0072B2",  // Azul oscuro
  "Asia": "#D55E00",    // Naranja rojizo
  "África": "#E69F00",  // Naranja amarillento
  "Oceanía": "#CC79A7"  // Púrpura rosado
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

  const traceKm = {
    x: kmReal.map(v => v + (maxKmGlobal * 0.12)), // Espaciado fijo del texto
    y: paises,
    mode: "text",
    text: kmReal.map(v => `${v.toFixed(1)} km`),
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
      duration: 500, // Medio segundo de animación
      easing: 'cubic-in-out' // Transición fluida
    }
  };

  // Usamos Plotly.react para animar en lugar de redibujar desde cero
  Plotly.react("graficoBarras", [traceBarras, traceKm], layout, { responsive: true, displayModeBar: false });

  // 4. Sonificación por clic en Plotly
  const graficoDiv = document.getElementById("graficoBarras");
  graficoDiv.removeAllListeners('plotly_click');
  graficoDiv.on('plotly_click', function(data){
    const kms = data.points[0].x;
    // Usamos el maxKmGlobal para consistencia rítmica
    reproducirSonificacion(kms, 0, maxKmGlobal);
  });
}

// ==============================
// MOTOR DE SONIFICACIÓN (Eficiencia)
// ==============================
function reproducirSonificacion(kmClick, minKm, maxKm) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  if(oscInterval) clearInterval(oscInterval); 

  // Ratio de 0 a 1 (0 = Menos eficiente, 1 = Más eficiente)
  let ratio = (kmClick - minKm) / (maxKm - minKm || 1);
  
  // Ritmo: Ineficiente = Lento (700ms), Eficiente = Rápido (150ms)
  let intervaloMs = 700 - (ratio * 550); 

  let contador = 0;
  oscInterval = setInterval(() => {
    // Le pasamos el ratio a la función del sonido para alterar el tono
    generarSonidoEficiencia(ratio);
    contador++;
    if(contador > 15) clearInterval(oscInterval);
  }, intervaloMs);
}

function generarSonidoEficiencia(ratio) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  // Onda 'sine': Sonido puro, suave y "eléctrico" (representa eficiencia y bajo roce)
  osc.type = 'sine'; 
  
  // Tono dinámico: Ineficiente = Sonido grave (200Hz), Eficiente = Sonido agudo (800Hz)
  const frecuencia = 200 + (ratio * 600);
  osc.frequency.value = frecuencia; 
  
  // Envolvente de volumen: un "ping" suave y futurista
  gain.gain.setValueAtTime(0, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0.7, audioCtx.currentTime + 0.02); // Sube rápido
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2); // Baja suavemente
  
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.25);
}
