fetch("datos/datos_a_utilizar.json")
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
      d["Categoria"] &&
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

    function crearGrafico(datos) {
      const ordenados = [...datos].sort(
        (a, b) => Number(b["Kilometros cargados con 50 dolares"]) - Number(a["Kilometros cargados con 50 dolares"])
      );

      const x = ordenados.map(d => d["País"]);
      const y = ordenados.map(d => Number(d["Kilometros cargados con 50 dolares"]));
      const colores = ordenados.map(d =>
        d["Categoria"] === "Top 2" ? "#16a34a" : "#dc2626"
      );

      const textos = ordenados.map(d =>
        `${d["País"]}<br>${d["Categoria"]}<br>${Number(d["Kilometros cargados con 50 dolares"]).toFixed(2)} km`
      );

      const trace = {
        x: x,
        y: y,
        type: "bar",
        marker: { color: colores },
        text: textos,
        hovertemplate: "%{text}<extra></extra>"
      };

      const layout = {
        title: "Kilómetros recorridos con 50 USD",
        xaxis: { title: "País" },
        yaxis: { title: "Kilómetros" },
        margin: { t: 60, r: 20, b: 80, l: 60 }
      };

      Plotly.newPlot("graficoBarras", [trace], layout, { responsive: true });
    }

    function crearRanking(datosBase) {
      const ordenados = [...datosBase].sort(
        (a, b) => Number(b["Kilometros cargados con 50 dolares"]) - Number(a["Kilometros cargados con 50 dolares"])
      );

      const mejores = ordenados.slice(0, 5);
      const peores = ordenados.slice(-5).reverse();

      topMejores.innerHTML = mejores
        .map(d => `<li><strong>${d["País"]}</strong>: ${Number(d["Kilometros cargados con 50 dolares"]).toFixed(2)} km</li>`)
        .join("");

      topPeores.innerHTML = peores
        .map(d => `<li><strong>${d["País"]}</strong>: ${Number(d["Kilometros cargados con 50 dolares"]).toFixed(2)} km</li>`)
        .join("");
    }

    function actualizarLectura(datos) {
      if (!datos.length) {
        lecturaGeneral.textContent = "No hay datos disponibles para este continente.";
        return;
      }

      const ordenados = [...datos].sort(
        (a, b) => Number(b["Kilometros cargados con 50 dolares"]) - Number(a["Kilometros cargados con 50 dolares"])
      );

      const mejor = ordenados[0];
      const peor = ordenados[ordenados.length - 1];

      lecturaGeneral.textContent =
        `En esta selección, el país con mejor rendimiento es ${mejor["País"]}, mientras que el de menor rendimiento es ${peor["País"]}. ` +
        `Esto evidencia diferencias importantes en la relación entre precio del combustible y eficiencia del vehículo.`;
    }

    function actualizarVista(continente) {
      let datosGrafico = datosValidos;

      if (continente !== "Todos") {
        datosGrafico = datosValidos.filter(d => d["Continente"] === continente);
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