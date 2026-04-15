fetch("datos/datos_a_utilizar.json?v=4")
  .then(response => {
    if (!response.ok) {
      throw new Error("No se pudo cargar el archivo datos/datos_a_utilizar.json");
    }
    return response.json();
  })
  .then(data => {
    const select = document.getElementById("continenteSelect");
    const topMejores = document.getElementById("topMejores");
    const topPeores = document.getElementById("topPeores");
    const lecturaGeneral = document.getElementById("lecturaGeneral");

    const datosValidos = data.filter(d =>
      d["País"] &&
      d["Continente"] &&
      d["Kilometros cargados con 50 dolares"] != null &&
      !Number.isNaN(Number(d["Kilometros cargados con 50 dolares"]))
    );

    const continentes = [...new Set(datosValidos.map(d => d["Continente"]))].sort();

    continentes.forEach(cont => {
      const option = document.createElement("option");
      option.value = cont;
      option.textContent = cont;
      select.appendChild(option);
    });

    function obtenerExtremosPorContinente(datos) {
      const resultado = [];

      continentes.forEach(cont => {
        const grupo = datos
          .filter(d => d["Continente"] === cont)
          .sort((a, b) =>
            Number(b["Kilometros cargados con 50 dolares"]) -
            Number(a["Kilometros cargados con 50 dolares"])
          );

        const mejores = grupo.slice(0, 2).map(d => ({ ...d, Tipo: "Top 2" }));
        const peores = grupo.slice(-2).map(d => ({ ...d, Tipo: "Bottom 2" }));

        resultado.push(...mejores, ...peores);
      });

      return resultado;
    }

    function crearGrafico(datos) {
      const ordenados = [...datos].sort(
        (a, b) => Number(b["Kilometros cargados con 50 dolares"]) - Number(a["Kilometros cargados con 50 dolares"])
      );

      const x = ordenados.map(d => d["País"]);
      const y = ordenados.map(d => Number(d["Kilometros cargados con 50 dolares"]));
      const colores = ordenados.map(d =>
        d["Tipo"] === "Top 2" ? "#16a34a" : "#dc2626"
      );

      const textos = ordenados.map(d =>
        `${d["País"]}<br>${d["Continente"]}<br>${d["Tipo"]}<br>${Number(d["Kilometros cargados con 50 dolares"]).toFixed(2)} km`
      );

      const trace = {
        x,
        y,
        type: "bar",
        marker: { color: colores },
        text: textos,
        hovertemplate: "%{text}<extra></extra>"
      };

      const layout = {
        title: "Kilómetros recorridos con 50 USD",
        xaxis: { title: "País" },
        yaxis: { title: "Kilómetros" },
        margin: { t: 60, r: 20, b: 100, l: 70 }
      };

      Plotly.newPlot("graficoBarras", [trace], layout, { responsive: true });
    }

    function crearRanking(datosBase) {
      const ordenados = [...datosBase].sort(
        (a, b) => Number(b["Kilometros cargados con 50 dolares"]) - Number(a["Kilometros cargados con 50 dolares"])
      );

      const mejores = ordenados.slice(0, 5);
      const peores = [...ordenados].slice(-5).reverse();

      topMejores.innerHTML = mejores
        .map(d => `<li><strong>${d["País"]}</strong>: ${Number(d["Kilometros cargados con 50 dolares"]).toFixed(2)} km</li>`)
        .join("");

      topPeores.innerHTML = peores
        .map(d => `<li><strong>${d["País"]}</strong>: ${Number(d["Kilometros cargados con 50 dolares"]).toFixed(2)} km</li>`)
        .join("");
    }

    function actualizarLectura(datos) {
      if (!datos.length) {
        lecturaGeneral.textContent = "No hay datos disponibles para esta selección.";
        return;
      }

      const ordenados = [...datos].sort(
        (a, b) => Number(b["Kilometros cargados con 50 dolares"]) - Number(a["Kilometros cargados con 50 dolares"])
      );

      const mejor = ordenados[0];
      const peor = ordenados[ordenados.length - 1];

      lecturaGeneral.textContent =
        `En esta selección, el país con mejor rendimiento es ${mejor["País"]} con ${Number(mejor["Kilometros cargados con 50 dolares"]).toFixed(2)} km, mientras que el menor rendimiento corresponde a ${peor["País"]} con ${Number(peor["Kilometros cargados con 50 dolares"]).toFixed(2)} km.`;
    }

    function actualizarVista(continente) {
      let base = datosValidos;

      if (continente !== "Todos") {
        base = datosValidos.filter(d => d["Continente"] === continente);
      }

      let datosGrafico;

      if (continente === "Todos") {
        datosGrafico = obtenerExtremosPorContinente(datosValidos);
      } else {
        const grupo = [...base].sort(
          (a, b) => Number(b["Kilometros cargados con 50 dolares"]) - Number(a["Kilometros cargados con 50 dolares"])
        );

        datosGrafico = [
          ...grupo.slice(0, 2).map(d => ({ ...d, Tipo: "Top 2" })),
          ...grupo.slice(-2).map(d => ({ ...d, Tipo: "Bottom 2" }))
        ];
      }

      crearGrafico(datosGrafico);
      crearRanking(datosValidos);
      actualizarLectura(datosGrafico);
    }

    select.addEventListener("change", e => {
      actualizarVista(e.target.value);
    });

    actualizarVista("Todos");
  })
  .catch(error => {
    console.error(error);
    document.getElementById("graficoBarras").innerHTML =
      `<div class="error">${error.message}</div>`;
  });