fetch("datos/datos_a_utilizar.json?v=5")
  .then(response => {
    if (!response.ok) {
      throw new Error("No se pudo cargar el archivo datos/datos_a_utilizar.json");
    }
    return response.json();
  })
  .then(data => {
    const topMejores = document.getElementById("topMejores");
    const topPeores = document.getElementById("topPeores");
    const lecturaGeneral = document.getElementById("lecturaGeneral");

    const datosValidos = data.filter(d =>
      d["País"] &&
      d["Continente"] &&
      d["Kilometros cargados con 50 dolares"] != null &&
      !Number.isNaN(Number(d["Kilometros cargados con 50 dolares"]))
    );
    // Definimos colores para cada continente
    const coloresContinente = {
      "América": "#2563eb",
      "Europa": "#7c3aed",
      "Asia": "#f59e0b",
      "África": "#16a34a",
      "Oceanía": "#ef4444"
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
          const mejores = grupo.slice(0, 2);
          const peores = grupo.slice(-2);
          resultado.push(...mejores, ...peores);
        }
      });

      return resultado.sort(
        (a, b) =>
          Number(b["Kilometros cargados con 50 dolares"]) -
          Number(a["Kilometros cargados con 50 dolares"])
      );
    }

    function crearGrafico(datos) {
      const x = datos.map(d => d["País"]);
      const y = datos.map(d => Number(d["Kilometros cargados con 50 dolares"]));
      const colores = datos.map(d => coloresContinente[d["Continente"]] || "#64748b");
      const textos = y.map(valor => `${valor.toFixed(1)} km`);

      const trace = {
        x: x,
        y: y,
        type: "bar",
        marker: {
          color: colores
        },
        text: textos,
        textposition: "outside",
        cliponaxis: false,
        hovertemplate:
          "<b>%{x}</b><br>" +
          "Km con 50 USD: %{y:.1f}<br>" +
          "<extra></extra>"
      };

      const layout = {
        title: "",
        xaxis: {
          title: "País",
          tickangle: 0,
          automargin: true
        },
        yaxis: {
          title: "Kilómetros recorridos con 50 USD",
          automargin: true
        },
        margin: { t: 40, r: 20, b: 100, l: 80 },
        showlegend: false
      };

      Plotly.newPlot("graficoBarras", [trace], layout, {
        responsive: true,
        displayModeBar: false
      });
    }

    function crearRanking(datosBase) {
      const ordenados = [...datosBase].sort(
        (a, b) =>
          Number(b["Kilometros cargados con 50 dolares"]) -
          Number(a["Kilometros cargados con 50 dolares"])
      );

      const mejores = ordenados.slice(0, 5);
      const peores = [...ordenados].slice(-5).reverse();

      topMejores.innerHTML = mejores
        .map(d =>
          `<li><strong>${d["País"]}</strong>: ${Number(d["Kilometros cargados con 50 dolares"]).toFixed(1)} km</li>`
        )
        .join("");

      topPeores.innerHTML = peores
        .map(d =>
          `<li><strong>${d["País"]}</strong>: ${Number(d["Kilometros cargados con 50 dolares"]).toFixed(1)} km</li>`
        )
        .join("");
    }

    function actualizarLectura(datos) {
      if (!datos.length) {
        lecturaGeneral.textContent = "No hay datos disponibles para generar la lectura general.";
        return;
      }

      const ordenados = [...datos].sort(
        (a, b) =>
          Number(b["Kilometros cargados con 50 dolares"]) -
          Number(a["Kilometros cargados con 50 dolares"])
      );

      const mejor = ordenados[0];
      const peor = ordenados[ordenados.length - 1];
      
      // Redactamos la lectura general utilizando los datos del mejor y peor país
      lecturaGeneral.textContent =
        `Dentro de los países seleccionados para la comparación, ${mejor["País"]} presenta el mayor rendimiento con ${Number(mejor["Kilometros cargados con 50 dolares"]).toFixed(1)} km recorridos con 50 USD, mientras que ${peor["País"]} muestra el menor rendimiento con ${Number(peor["Kilometros cargados con 50 dolares"]).toFixed(1)} km.`;
    }

    const datosGrafico = obtenerSeleccionGrafico(datosValidos);
    crearGrafico(datosGrafico);
    crearRanking(datosValidos);
    actualizarLectura(datosGrafico);
  })
  .catch(error => {
    console.error(error);
    document.getElementById("graficoBarras").innerHTML =
      `<div class="error">${error.message}</div>`;
  });