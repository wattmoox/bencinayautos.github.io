function crearGrafico(datos) {
  const paises = datos.map(d => d["País"]);
  const km = datos.map(d => Number(d["Kilometros cargados con 50 dolares"]));
  const autos = datos.map(d => d["Sedán Más Vendido (Combustión)"]);
  const colores = datos.map(d => coloresContinente[d["Continente"]] || "#64748b");

  const maxKm = Math.max(...km);

  const imagenesAutos = {
    "Suzuki Dzire": "img/autos/suzuki_dzire.png",
    "Kia Soluto": "img/autos/kia_soluto.png",
    "Nissan Versa": "img/autos/nissan_versa.png",
    "Chevrolet Onix Plus": "img/autos/chevrolet_onix_plus.png",
    "Maruti Suzuki Dzire": "img/autos/maruti_suzuki_dzire.png",
    "Toyota Corolla": "img/autos/toyota_corolla.png",
    "Skoda Octavia": "img/autos/skoda_octavia.png",
    "Dacia Logan": "img/autos/dacia_logan.png",
    "Volkswagen Polo Sedan": "img/autos/volkswagen_polo_sedan.png",
    "Mercedes Benz Class E": "img/autos/mercedes_benz_class_e.png",
    "Hyundai Grandeur": "img/autos/hyundai_grandeur.png",
    "Toyota Camry": "img/autos/toyota_camry.png",
    "Nissan Sylphy": "img/autos/nissan_sylphy.png"
  };

  const mejor = datos.reduce((acc, d) =>
    Number(d["Kilometros cargados con 50 dolares"]) > Number(acc["Kilometros cargados con 50 dolares"]) ? d : acc
  );

  const peor = datos.reduce((acc, d) =>
    Number(d["Kilometros cargados con 50 dolares"]) < Number(acc["Kilometros cargados con 50 dolares"]) ? d : acc
  );

  const traceBarras = {
    x: km,
    y: paises,
    orientation: "h",
    type: "bar",
    width: 0.70,
    marker: {
      color: colores
    },
    hovertemplate:
      "<b>%{y}</b><br>" +
      "Km con 50 USD: %{x:.1f}<br>" +
      "<extra></extra>"
  };

  const traceKm = {
    x: km.map(v => v + 25),
    y: paises,
    mode: "text",
    text: km.map(v => `${v.toFixed(1)} km`),
    textposition: "middle right",
    textfont: {
      color: "#1f2937",
      size: 13
    },
    hoverinfo: "skip",
    showlegend: false
  };

  const anotacionesModelos = datos.map((d, i) => ({
    x: Math.max(km[i] * 0.38, 90),
    y: paises[i],
    xref: "x",
    yref: "y",
    text: `<b>${d["Sedán Más Vendido (Combustión)"]}</b>`,
    showarrow: false,
    font: {
      color: "white",
      size: 16
    },
    align: "center"
  }));

  const anotacionesEspeciales = [
    {
      x: km[indiceMejor],
      y: paises[indiceMejor],
      xref: "x",
      yref: "y",
      text: `<b>Dato interesante</b><br>${mejor["País"]} logra el mayor recorrido con ${km[indiceMejor].toFixed(1)} km.`,
      showarrow: true,
      arrowhead: 2,
      ax: -180,
      ay: -60,
      arrowwidth: 2,
      arrowsize: 1,
      bgcolor: "rgba(255,255,255,0.95)",
      bordercolor: coloresContinente[mejor["Continente"]] || "#111827",
      borderwidth: 1,
      font: {
        size: 12,
        color: "#111827"
      },
      align: "left"
    },
    {
      x: km[indicePeor],
      y: paises[indicePeor],
      xref: "x",
      yref: "y",
      text: `<b>Dato interesante</b><br>${peor["País"]} presenta el menor rendimiento del conjunto.`,
      showarrow: true,
      arrowhead: 2,
      ax: 170,
      ay: 45,
      arrowwidth: 2,
      arrowsize: 1,
      bgcolor: "rgba(255,255,255,0.95)",
      bordercolor: coloresContinente[peor["Continente"]] || "#111827",
      borderwidth: 1,
      font: {
        size: 12,
        color: "#111827"
      },
      align: "left"
    }
  ];

  const imagenesDentroBarras = datos
    .filter(d => imagenesAutos[d["Sedán Más Vendido (Combustión)"]])
    .map((d, i) => ({
      source: imagenesAutos[d["Sedán Más Vendido (Combustión)"]],
      xref: "x",
      yref: "y",
      x: Math.max(km[i] - maxKm * 0.08, km[i] * 0.78),
      y: paises[i],
      sizex: maxKm * 0.11,
      sizey: 0.52,
      xanchor: "center",
      yanchor: "middle",
      sizing: "contain",
      opacity: 1,
      layer: "above"
    }));

  const layout = {
    xaxis: {
      showgrid: false,
      showticklabels: false,
      zeroline: false,
      title: "",
      range: [0, maxKm * 1.2]
    },
    yaxis: {
      title: "",
      automargin: true,
      tickfont: {
        size: 13
      }
    },
    margin: { t: 70, r: 130, b: 30, l: 150 },
    showlegend: false,
    height: 720,
    plot_bgcolor: "white",
    paper_bgcolor: "white",
    annotations: [...anotacionesModelos, ...anotacionesEspeciales],
    images: imagenesDentroBarras
  };

  Plotly.newPlot("graficoBarras", [traceBarras, traceKm], layout, {
    responsive: true,
    displayModeBar: false
  });
}