const isoFallback = {
  "Brasil": "BRA",
  "Haití": "HTI",
  "México": "MEX",
  "Panamá": "PAN",
  "Perú": "PER",
  "República Dominicana": "DOM",
  "Estados Unidos": "USA",
  "Rusia": "RUS",
  "Japón": "JPN",
  "Alemania": "DEU",
  "Reino Unido": "GBR",
  "Francia": "FRA",
  "Italia": "ITA",
  "Canadá": "CAN",
  "España": "ESP",
  "Corea del Sur": "KOR",
  "Arabia Saudita": "SAU",
  "Turquía": "TUR",
  "Sudáfrica": "ZAF",
  "Egipto": "EGY",
  "Marruecos": "MAR",
  "Tailandia": "THA",
  "Pakistán": "PAK",
  "Suecia": "SWE",
  "Noruega": "NOR",
  "Suiza": "CHE",
  "Grecia": "GRC",
  "Polonia": "POL",
  "Ucrania": "UKR",
  "Filipinas": "PHL"
};

function formatNumber(value, digits = 1) {
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

fetch("datos/datos_limpios.json")
  .then(response => {
    if (!response.ok) {
      throw new Error("No se pudo cargar datos/datos_limpios.json");
    }
    return response.json();
  })
  .then(datos => {
    const normalizados = datos
      .map(d => ({
        pais: d["País"],
        sedan: d["Sedán Más Vendido (Combustión)"],
        consumo: Number(d["Consumo Mixto Aprox."]),
        precioLitro: Number(d["Precio Aprox. Litro Gasolina (USD)"]),
        litros50: Number(d["Litros cargados con 50 dolares"]),
        kilometros50: Number(d["Kilometros cargados con 50 dolares"]),
        iso_alpha: d.iso_alpha || isoFallback[d["País"]] || null
      }))
      .filter(d => d.iso_alpha && !Number.isNaN(d.kilometros50));

    if (!normalizados.length) {
      throw new Error("No hay países válidos con código ISO-3 para graficar.");
    }

    const ordenados = [...normalizados].sort((a, b) => b.kilometros50 - a.kilometros50);
    const mejor = ordenados[0];
    const promedio =
      normalizados.reduce((acc, d) => acc + d.kilometros50, 0) / normalizados.length;

    document.getElementById("total-paises").textContent = normalizados.length;
    document.getElementById("mejor-pais").textContent =
      `${mejor.pais} (${formatNumber(mejor.kilometros50, 0)} km)`;
    document.getElementById("promedio-km").textContent =
      `${formatNumber(promedio, 0)} km`;

    document.getElementById("top-list").innerHTML = ordenados
      .slice(0, 5)
      .map(d => `<li><strong>${d.pais}</strong>: ${formatNumber(d.kilometros50, 0)} km</li>`)
      .join("");

    const trace = {
      type: "choropleth",
      locationmode: "ISO-3",
      locations: normalizados.map(d => d.iso_alpha),
      z: normalizados.map(d => d.kilometros50),
      text: normalizados.map(d => d.pais),
      customdata: normalizados.map(d => [
        d.sedan,
        d.consumo,
        d.precioLitro,
        d.litros50,
        d.kilometros50
      ]),
      colorscale: "Blues",
      reversescale: false,
      colorbar: {
        title: "Km con 50 USD",
        tickfont: { color: "#e2e8f0" },
        titlefont: { color: "#e2e8f0" }
      },
      marker: {
        line: {
          color: "rgba(255,255,255,0.5)",
          width: 0.5
        }
      },
      hovertemplate:
        "<b>%{text}</b><br>" +
        "Sedán más vendido: %{customdata[0]}<br>" +
        "Consumo mixto aprox.: %{customdata[1]:.1f} km/L<br>" +
        "Precio litro gasolina: USD %{customdata[2]:.2f}<br>" +
        "Litros con 50 USD: %{customdata[3]:.1f} L<br>" +
        "<b>Kilómetros con 50 USD: %{customdata[4]:.0f} km</b>" +
        "<extra></extra>"
    };

    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { t: 10, r: 10, b: 10, l: 10 },
      geo: {
        scope: "world",
        projection: { type: "natural earth" },
        bgcolor: "rgba(0,0,0,0)",
        showframe: false,
        showcoastlines: true,
        coastlinecolor: "#94a3b8",
        showcountries: true,
        countrycolor: "#475569",
        showland: true,
        landcolor: "#1e293b",
        lakecolor: "#0f172a",
        showlakes: true
      },
      font: {
        color: "#f8fafc"
      }
    };

    Plotly.newPlot("mapa", [trace], layout, {
      responsive: true,
      displayModeBar: true
    });
  })
  .catch(error => {
    console.error(error);
    document.getElementById("mapa").innerHTML = `<div class="error">${error.message}</div>`;
  });