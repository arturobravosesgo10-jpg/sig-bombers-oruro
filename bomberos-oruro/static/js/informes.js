
// ============================================
// SIG BOMBERS - GESTIÓN DE INFORMES PDF
// ============================================

// ============================================
// SUBIR INFORME PDF
// ============================================

function abrirSubirInforme(incidenteId, codigo) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";

    input.onchange = async () => {
        const archivo = input.files[0];

        if (!archivo) return;

        if (archivo.type !== "application/pdf") {
            alert("Solo se permiten archivos PDF.");
            return;
        }

        if (archivo.size > 10 * 1024 * 1024) {
            alert("El archivo no puede pesar más de 10 MB.");
            return;
        }

        const formData = new FormData();
        formData.append("incidente_id", incidenteId);
        formData.append("archivo", archivo);

        try {
            const respuesta = await fetch(`${API}/api/informes`, {
                method: "POST",
                credentials: "include",
                body: formData
            });

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                alert("Error al subir el informe:\n" +
                    (resultado.error || "Error desconocido"));
                return;
            }

            alert("Informe subido correctamente para " + codigo);

            cargarIncidentes();

            // Actualizar la lista si el panel de informes está abierto.
            const panel = document.getElementById("panelInformes");

            if (panel && !panel.classList.contains("oculto")) {
                cargarInformes();
            }

        } catch (error) {
            console.error("Error subiendo informe:", error);
            alert("No se pudo conectar con el servidor.");
        }
    };

    input.click();
}

// ============================================
// LISTAR INFORMES
// ============================================

async function cargarInformes() {
    const lista = document.getElementById("listaInformes");

    if (!lista) return;

    lista.innerHTML = `
        <p class="cargando-informes">
            Cargando informes...
        </p>
    `;

    try {
        const respuesta = await fetch(`${API}/api/informes`, {
            method: "GET",
            credentials: "include"
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            lista.innerHTML = `
                <p class="error-informes">
                    ${escaparHTML(resultado.error || "No se pudieron cargar los informes.")}
                </p>
            `;
            return;
        }

        const informes = resultado.informes || [];

        if (informes.length === 0) {
            lista.innerHTML = `
                <div class="sin-informes">
                    <ion-icon name="document-text-outline"></ion-icon>
                    <p>No hay informes registrados todavía.</p>
                    <small>Los informes PDF aparecerán aquí cuando sean subidos.</small>
                </div>
            `;
            return;
        }

        lista.innerHTML = informes.map(informe => `
            <article class="informe-item">

                <div class="informe-cabecera">

                    <div class="informe-icono">
                        <ion-icon name="document-text-outline"></ion-icon>
                    </div>

                    <div>
                        <strong>${escaparHTML(informe.codigo)}</strong>
                        <small>${escaparHTML(informe.tipo)}</small>
                    </div>

                </div>

                <div class="informe-detalles">

                    <p>
                        <ion-icon name="calendar-outline"></ion-icon>
                        <span>
                            ${formatearFechaInforme(informe.fecha_hora)}
                        </span>
                    </p>

                    <p>
                        <ion-icon name="document-outline"></ion-icon>
                        <span>
                            ${escaparHTML(informe.archivo_pdf)}
                        </span>
                    </p>

                </div>

                <div class="informe-acciones">

                    <button
                        type="button"
                        onclick="verInforme(${Number(informe.id)})">
                        <ion-icon name="eye-outline"></ion-icon>
                        Ver PDF
                    </button>

                    <button
                        type="button"
                        onclick="ubicarIncidenteInforme(
                            ${Number(informe.incidente_id)},
                            ${Number(informe.latitud)},
                            ${Number(informe.longitud)}
                        )">
                        <ion-icon name="location-outline"></ion-icon>
                        Ubicar
                    </button>

                </div>

            </article>
        `).join("");

    } catch (error) {
        console.error("Error cargando informes:", error);

        lista.innerHTML = `
            <p class="error-informes">
                No se pudo conectar con el servidor.
            </p>
        `;
    }
}

// ============================================
// ABRIR PDF
// ============================================

function verInforme(informeId) {
    window.open(`${API}/api/informes/${informeId}`, "_blank");
}

// ============================================
// UBICAR INCIDENTE EN EL MAPA
// ============================================

async function ubicarIncidenteInforme(incidenteId, latitud, longitud) {
    if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
        alert("Las coordenadas del incidente no son válidas.");
        return;
    }

    cerrarMenu();

    let marcador = marcadoresIncidentes[incidenteId];

    // Si el marcador todavía no existe, cargar los incidentes.
    if (!marcador) {
        await cargarIncidentes();
        marcador = marcadoresIncidentes[incidenteId];
    }

    map.setView([latitud, longitud], 17);

    if (marcador) {
        setTimeout(() => {
            marcador.openPopup();
        }, 350);
    } else {
        alert("Se ubicó el punto, pero no se encontró el marcador del incidente.");
    }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caracter]);
}

function formatearFechaInforme(fecha) {
    if (!fecha) return "Fecha no disponible";

    const fechaConvertida = new Date(fecha);

    if (Number.isNaN(fechaConvertida.getTime())) {
        return "Fecha no disponible";
    }

    return fechaConvertida.toLocaleString("es-BO", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}
