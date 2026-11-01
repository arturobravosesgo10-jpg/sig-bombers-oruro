// ============================================
// NOTIFICACIONES
// ============================================

const btnNotificaciones = document.getElementById("btnNotificaciones");
const panelNotificaciones = document.getElementById("panelNotificaciones");
const listaNotificaciones = document.getElementById("listaNotificaciones");
const btnPendientes = document.getElementById("btnPendientes");
const btnLeidas = document.getElementById("btnLeidas");

let pestañaNotificaciones = "pendientes";

async function cargarNotificaciones() {

    try {

        const respuesta = await fetch(
            `${API}/api/notificaciones`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        const resultado = await respuesta.json();

        console.log("Notificaciones recibidas:", resultado);

        if (!respuesta.ok) {

            console.error(
                "Error cargando notificaciones:",
                resultado.error
            );

            return;
        }

        listaNotificaciones.innerHTML = "";


        // ============================================
        // FILTRAR SEGÚN LA PESTAÑA
        // ============================================

        const notificacionesFiltradas = resultado.notificaciones.filter(
            (notificacion) => {

                if (pestañaNotificaciones === "pendientes") {
                    return !notificacion.leida;
                }

                if (pestañaNotificaciones === "leidas") {
                    return notificacion.leida;
                }

            }
        );


        // ============================================
        // SI NO HAY NOTIFICACIONES
        // ============================================

        if (notificacionesFiltradas.length === 0) {

            if (pestañaNotificaciones === "pendientes") {

                listaNotificaciones.innerHTML =
                    "<p>🔴 No tienes notificaciones pendientes.</p>";

            } else {

                listaNotificaciones.innerHTML =
                    "<p>🔔 No tienes notificaciones leídas.</p>";

            }

            return;
        }


        // ============================================
        // MOSTRAR NOTIFICACIONES
        // ============================================

        notificacionesFiltradas.forEach((notificacion) => {

            const elemento = document.createElement("div");

            elemento.className = "notificacion";

            elemento.innerHTML = `
                <strong>
                    ${notificacion.leida ? "🔔" : "🔴"}
                    ${notificacion.codigo_incidente}
                </strong>

                <p>
                    ${notificacion.mensaje}
                </p>

                <small>
                    Estado: ${notificacion.estado}
                </small>
            `;

            // Al hacer clic en la notificación
            elemento.addEventListener("click", async () => {

                // ============================================
                // MARCAR NOTIFICACIÓN COMO LEÍDA
                // ============================================

                if (!notificacion.leida) {

                    try {

                        const respuestaLeida = await fetch(
                            `${API}/api/notificaciones/${notificacion.id}/leer`,
                            {
                                method: "PUT",
                                credentials: "include"
                            }
                        );

                        const resultadoLeida =
                            await respuestaLeida.json();

                        console.log(
                            "Notificación marcada como leída:",
                            resultadoLeida
                        );

                        if (!respuestaLeida.ok) {

                            console.error(
                                "No se pudo marcar como leída:",
                                resultadoLeida.error
                            );

                        }

                    } catch (error) {

                        console.error(
                            "Error marcando notificación como leída:",
                            error
                        );

                    }

                }


                // ============================================
                // BUSCAR INCIDENTE EN EL MAPA
                // ============================================

                const marcador =
                    marcadoresIncidentes[notificacion.incidente_id];

                if (marcador) {

                    const posicion = marcador.getLatLng();

                    // Cerrar panel
                    panelNotificaciones.classList.add("oculto");

                    // Centrar mapa
                    map.setView(
                        [posicion.lat, posicion.lng],
                        17
                    );

                    // Abrir información del incendio
                    marcador.openPopup();

                } else {

                    console.error(
                        "No se encontró el marcador del incidente:",
                        notificacion.incidente_id
                    );

                }

                // ============================================
                // ACTUALIZAR NOTIFICACIONES
                // ============================================

                cargarNotificaciones();

            });

            listaNotificaciones.appendChild(elemento);

        });

    } catch (error) {

        console.error(
            "No se pudieron cargar las notificaciones:",
            error
        );

    }
}

// ============================================
// PESTAÑA PENDIENTES
// ============================================

btnPendientes.addEventListener("click", () => {

    pestañaNotificaciones = "pendientes";

    btnPendientes.classList.add("activa");
    btnLeidas.classList.remove("activa");

    cargarNotificaciones();
});

// ============================================
// PESTAÑA LEÍDAS
// ============================================

btnLeidas.addEventListener("click", () => {

    pestañaNotificaciones = "leidas";

    btnLeidas.classList.add("activa");
    btnPendientes.classList.remove("activa");

    cargarNotificaciones();
});

// ============================================
// MENÚ → NOTIFICACIONES
// ============================================

document
    .getElementById("menuNotificaciones")
    .addEventListener("click", () => {

        mostrarPanelMenu(
            "panelNotificaciones",
            "menuNotificaciones"
        );

        cargarNotificaciones();

    });
