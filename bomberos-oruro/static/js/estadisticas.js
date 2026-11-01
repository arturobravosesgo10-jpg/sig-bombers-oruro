// ============================================
// BOTÓN REPORTAR INCENDIO
// ============================================

const btnIncendio = document.getElementById("btnIncendio");

function actualizarControlesPorRol() {
    const puedeReportar = rolActual === "CIUDADANO";
    const esJefe = rolActual === "JEFE";
    const esCiudadano = rolActual === "CIUDADANO";

    // Botón de reportar incendio
    btnIncendio.classList.toggle("oculto", !puedeReportar);

    // Opciones del menú lateral

    const menuEstadisticas = document.getElementById("menuEstadisticas");
    const menuPostulaciones = document.getElementById("menuPostulaciones");

    if (menuEstadisticas) {
        menuEstadisticas.classList.toggle("oculto", !esJefe);
    }

    if (menuPostulaciones) {
        menuPostulaciones.classList.toggle(
            "oculto",
            !(esCiudadano || esJefe)
        );
    }


    if (!puedeReportar) {
        modoIncendio = false;
        btnIncendio.textContent = "🔥 Reportar incendio";
    }
}

function formatearMinutos(minutos) {
    if (minutos === null || minutos === undefined) {
        return "—";
    }

    const total = Math.round(minutos);
    const horas = Math.floor(total / 60);
    const restantes = total % 60;

    return horas > 0 ? `${horas} h ${restantes} min` : `${restantes} min`;
}

async function cargarEstadisticas() {
    resumenEstadisticas.innerHTML = "<p>Cargando estadísticas...</p>";
    graficoTipos.innerHTML = "";

    try {
        const respuesta = await fetch(`${API}/api/estadisticas`, {
            method: "GET",
            credentials: "include"
        });
        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudieron cargar las estadísticas.");
        }

        const resumen = resultado.resumen;
        resumenEstadisticas.innerHTML = `
            <div class="tarjeta-estadistica"><span>Incidentes este mes</span><strong>${resumen.incidentes_mes}</strong></div>
            <div class="tarjeta-estadistica"><span>Total registrado</span><strong>${resumen.total_incidentes}</strong></div>
            <div class="tarjeta-estadistica"><span>Reportados</span><strong>${resumen.reportados}</strong></div>
            <div class="tarjeta-estadistica"><span>En camino</span><strong>${resumen.en_camino}</strong></div>
            <div class="tarjeta-estadistica"><span>Atendidos</span><strong>${resumen.atendidos}</strong></div>
            <div class="tarjeta-estadistica"><span>Promedio de respuesta</span><strong>${formatearMinutos(resumen.promedio_respuesta_minutos)}</strong></div>
            <div class="tarjeta-estadistica"><span>Promedio de atención</span><strong>${formatearMinutos(resumen.promedio_atencion_minutos)}</strong></div>
        `;

        if (resultado.por_tipo.length === 0) {
            graficoTipos.innerHTML = "<p>Aún no hay incidentes registrados.</p>";
            return;
        }

        const maximo = Math.max(...resultado.por_tipo.map(item => item.cantidad));
        resultado.por_tipo.forEach((item) => {
            const fila = document.createElement("div");
            fila.className = "fila-grafico";
            fila.innerHTML = `
                <span>${item.tipo}</span>
                <div class="barra-grafico"><div style="width: ${(item.cantidad / maximo) * 100}%"></div></div>
                <strong>${item.cantidad}</strong>
            `;
            graficoTipos.appendChild(fila);
        });
    } catch (error) {
        console.error("Error cargando estadísticas:", error);
        resumenEstadisticas.innerHTML = `<p class="error-estadisticas">${error.message}</p>`;
    }
}
