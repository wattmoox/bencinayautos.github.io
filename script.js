fetch("datos/datos_a_utilizar.json?v=11")
  .then(response => {
    if (!response.ok) {
      throw new Error("No se pudo cargar el archivo datos/datos_a_utilizar.json");
    }
    return response.json();
  })
  .then(data => {
    const datosValidos = data.filter(d =>
      d["País"] &&
      d["Continente"] &&
      d["Sedán Más Vendido (Combustión)"] &&
      d["Kilometros cargados con 50 dolares"] != null &&
      !Number.isNaN(Number(d["Kilometros cargados con 50 dolares"]))
    );
    // Colores asignados a cada continente para el gráfico
    const coloresContinente = {
      "América": "#31ED31",
      "Europa": "#31ED8F",
      "Asia": "#31EDED",
      "África": "#ED31ED",
      "Oceanía": "#ED3131"
    };

    function obtenerSeleccionGrafico(datos) {
      const continentes = [...new Set(datos.map(d => d["Continente"]))];
      const resultado = [];

      continentes.forEach(cont => {
        const grupo = datos
          .filter(d => d["Continente"] === cont)
          .sort(
            (a, b) =>
              Number(b["Kilometros cargados con 50 dolares"]) -
              Number(a["Kilometros cargados con 50 dolares"])
          );

        if (grupo.length <= 4) {
          resultado.push(...grupo);
        } else {
          resultado.push(...grupo.slice(0, 2), ...grupo.slice(-2));
        }
      });

      return resultado.sort(
        (a, b) =>
          Number(a["Kilometros cargados con 50 dolares"]) -
          Number(b["Kilometros cargados con 50 dolares"])
      );
    }

    function crearGrafico(datos) {
      const paises = datos.map(d => d["País"]);

      const kmReal = datos.map(d => Number(d["Kilometros cargados con 50 dolares"]));
      const kmVisual = kmReal.map(v => Math.max(v, 280));

      const colores = datos.map(d => coloresContinente[d["Continente"]] || "#64748b");
      const maxKm = Math.max(...kmVisual);

      const imagenesAutos = {
        "Suzuki Dzire": "img/autos/susuki_dzire.png",
        "Kia Soluto": "img/autos/kia_soluto.png",
        "Nissan Versa": "img/autos/nissan_versa.png",
        "Chevrolet Onix Plus": "img/autos/chevrolet_onix_plus.png",
        "Maruti Suzuki Dzire": "img/autos/maruti_susuki_dzire.png",
        "Toyota Corolla": "img/autos/toyoya_corolla.png",
        "Skoda Octavia": "img/autos/skoda_octavia.png",
        "Dacia Logan": "img/autos/renault_dacia_logan.png",
        "Volkswagen Polo Sedan": "img/autos/volkswagen_polo.png",
        "Mercedes Benz Class E": "img/autos/mercedes_clase_e.png",
        "Hyundai Grandeur": "img/autos/hyundai_grandeur.png",
        "Toyota Camry": "img/autos/toyota_camry.png",
        "Nissan Sylphy": "img/autos/nissan sylphy.png",
        "Lada Granta": "img/autos/lada_granta.png",
        "Toyota Vios": "img/autos/toyota_vios.png",
        "BMW Serie 3": "img/autos/bmw_series3.png"
      };

      const mejor = datos.reduce((acc, d) =>
        Number(d["Kilometros cargados con 50 dolares"]) > Number(acc["Kilometros cargados con 50 dolares"]) ? d : acc
      );

      const peor = datos.reduce((acc, d) =>
        Number(d["Kilometros cargados con 50 dolares"]) < Number(acc["Kilometros cargados con 50 dolares"]) ? d : acc
      );

      const indiceMejor = datos.findIndex(d => d["País"] === mejor["País"]);
      const indicePeor = datos.findIndex(d => d["País"] === peor["País"]);

      const traceBarras = {
        x: kmVisual,
        y: paises,
        orientation: "h",
        type: "bar",
        width: 0.92,
        marker: {
          color: colores
        },
        hovertemplate:
          "<b>%{y}</b><br>" +
          "Km con 50 USD: %{customdata:.1f}<br>" +
          "<extra></extra>",
        customdata: kmReal
      };

      const traceKm = {
        x: kmVisual.map(v => v + 25),
        y: paises,
        mode: "text",
        text: kmReal.map(v => `${v.toFixed(1)} km`),
        textposition: "middle right",
        textfont: {
          color: "#1f2937",
          size: 13
        },
        hoverinfo: "skip",
        showlegend: false
      };

      const anotacionesModelos = datos.map((d, i) => {
        let modelo = d["Sedán Más Vendido (Combustión)"];

        if (modelo === "Mercedes Benz Class E") {
          modelo = "Mercedes Benz<br>Class E";
        }

        if (modelo === "Maruti Suzuki Dzire") {
          modelo = "Maruti Suzuki<br>Dzire";
        }

        if (modelo === "Volkswagen Polo Sedan") {
          modelo = "Volkswagen<br>Polo Sedan";
        }

        if (modelo === "Chevrolet Onix Plus") {
          modelo = "Chevrolet<br>Onix Plus";
        }

        return {
          x: Math.max(kmVisual[i] * 0.36, 70),
          y: paises[i],
          xref: "x",
          yref: "y",
          text: `<b>${modelo}</b>`,
          showarrow: false,
          font: {
            color: "white",
            size: 17
          },
          align: "center"
        };
      });

      const anotacionesEspeciales = [
        {
          x: kmVisual[indiceMejor],
          y: paises[indiceMejor],
          xref: "x",
          yref: "y",
          // Texto del dato India
          text: `<b>Dato interesante</b><br>${mejor["País"]} logra el mayor recorrido con ${kmReal[indiceMejor].toFixed(1)} km.`,
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
          x: kmVisual[indicePeor],
          y: paises[indicePeor],
          xref: "x",
          yref: "y",
          // Texto de Hong Kong
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

      const imagenesDentroBarras = datos.map((d, i) => {
        const ruta = imagenesAutos[d["Sedán Más Vendido (Combustión)"]];
        if (!ruta) return null;

        return {
          source: ruta,
          xref: "x",
          yref: "y",
          x: Math.max(kmVisual[i] - maxKm * 0.035, kmVisual[i] * 0.86),
          y: paises[i],
          sizex: maxKm * 0.14,
          sizey: 0.72,
          xanchor: "center",
          yanchor: "middle",
          sizing: "contain",
          opacity: 1,
          layer: "above"
        };
      }).filter(Boolean);

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
        height: 920,
        bargap: 0.12,
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

    const datosGrafico = obtenerSeleccionGrafico(datosValidos);
    crearGrafico(datosGrafico);
  })
  .catch(error => {
    console.error(error);
    document.getElementById("graficoBarras").innerHTML =
      `<div class="error">${error.message}</div>`;
  });