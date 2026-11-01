// ============================================
// VARIABLES
// ============================================

let modoIncendio = false;
let marcadorIncendio = null;

const marcadoresIncidentes = {};

const btnEstadisticas = document.getElementById("btnEstadisticas");
const panelEstadisticas = document.getElementById("panelEstadisticas");
const resumenEstadisticas = document.getElementById("resumenEstadisticas");
const graficoTipos = document.getElementById("graficoTipos");

// ============================================
// ICONOS DE INCIDENTES SEGÚN ESTADO
// ============================================


function obtenerIconoIncidente(estado) {
    let icono = "flame-outline";
    let clase = "marcador-reportado";

    if (estado === "EN_CAMINO") {
        icono = "car-sport-outline";
        clase = "marcador-en-camino";
    }

    if (estado === "ATENDIDO") {
        icono = "checkmark-circle-outline";
        clase = "marcador-atendido";
    }

    return L.divIcon({
        className: clase,
        html: `
            <div class="icono-incidente">
                <ion-icon name="${icono}"></ion-icon>
            </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
    });
}

// ============================================
// SELECCIONAR LUGAR DEL INCENDIO
// ============================================

map.on("click", (e) => {

    if (!modoIncendio) {
        return;
    }

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    console.log("Incendio seleccionado");
    console.log("Latitud:", lat);
    console.log("Longitud:", lng);

    if (marcadorIncendio) {
        map.removeLayer(marcadorIncendio);
    }

    marcadorIncendio = L.marker([lat, lng])
        .addTo(map)

            .bindPopup(`
                <div class="popup-incidente">
                    <h3>
                        <ion-icon name="flame-outline"></ion-icon>
                        Incendio
                    </h3>

                    <p>
                        <ion-icon name="location-outline"></ion-icon>
                        <strong>Latitud:</strong> ${lat.toFixed(6)}
                    </p>

                    <p>
                        <ion-icon name="navigate-outline"></ion-icon>
                        <strong>Longitud:</strong> ${lng.toFixed(6)}
                    </p>

                    <button onclick="confirmarIncendio()">
                        <ion-icon name="checkmark-circle-outline"></ion-icon>
                        Confirmar incendio
                    </button>
                </div>
            `)
            .openPopup();

    modoIncendio = false;

    btnIncendio.innerHTML =
    '<ion-icon name="flame-outline"></ion-icon> Reportar incendio';
});

// ============================================
// CONFIRMAR INCENDIO
// ============================================

async function confirmarIncendio() {

    if (!marcadorIncendio) {
        return;
    }

    const posicion = marcadorIncendio.getLatLng();

    const latitud = posicion.lat;
    const longitud = posicion.lng;

    const datos = {
        tipo: "Incendio",
        descripcion: "Incendio reportado desde el mapa",
        latitud: latitud,
        longitud: longitud
    };

    console.log("Enviando incidente:", datos);

    try {

        const respuesta = await fetch(
            `${API}/api/incidentes`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                credentials: "include",

                body: JSON.stringify(datos)
            }
        );

        const resultado = await respuesta.json();

        console.log("Respuesta del servidor:", resultado);

        if (!respuesta.ok) {

            alert(
                "❌ No se pudo registrar el incendio:\n" +
                resultado.error
            );

            return;
        }

        alert(
            "🚨 Incendio registrado correctamente.\n\n" +
            resultado.incidente.codigo
        );

        console.log(
            "Incidente creado:",
            resultado.incidente
        );

        // Cambiar popup del marcador
        marcadorIncendio
            .bindPopup(`
                <strong>🔥 Incidente registrado</strong><br><br>

                <strong>${resultado.incidente.codigo}</strong><br>
                Estado: ${resultado.incidente.estado}<br>
                Tipo: ${resultado.incidente.tipo}
            `)
            .openPopup();

    } catch (error) {

        console.error(error);

        alert(
            "❌ No se pudo conectar con el backend."
        );
    }
}

// ============================================
// CARGAR INCIDENTES DEL BACKEND
// ============================================

async function cargarIncidentes() {

    try {

        const respuesta = await fetch(
            `${API}/api/incidentes`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        const resultado = await respuesta.json();

        console.log("Incidentes recibidos:", resultado);

        if (!respuesta.ok) {

            console.error(
                "Error cargando incidentes:",
                resultado.error
            );

            return;
        }

        resultado.incidentes.forEach((incidente) => {

            const marcador = L.marker(
                [
                    incidente.latitud,
                    incidente.longitud
                ],
                {
                    icon: obtenerIconoIncidente(incidente.estado)
                }
            ).addTo(map);

            marcadoresIncidentes[incidente.id] = marcador;

            marcador.on("click", () => {

                map.setView(
                [incidente.latitud, incidente.longitud],
                17
                );

            });

            let botonesEstado = "";
            let botonInforme = "";

            // Botones de estado (solo Jefe)
            if (rolActual === "JEFE" && incidente.estado === "REPORTADO") {

                botonesEstado = `
                    <br>
                    <button onclick="cambiarEstadoIncidente(${incidente.id}, 'EN_CAMINO')">
                        <ion-icon name="car-sport-outline"></ion-icon>
                        EN CAMINO
                    </button>
                `;

            } else if (rolActual === "JEFE" && incidente.estado === "EN_CAMINO") {

                botonesEstado = `
                    <br>
                    <button onclick="cambiarEstadoIncidente(${incidente.id}, 'ATENDIDO')">
                        <ion-icon name="checkmark-circle-outline"></ion-icon>
                        ATENDIDO
                    </button>
                `;

            } else if (incidente.estado === "ATENDIDO") {
                botonesEstado = `
                    <br>
                    <strong>
                        <ion-icon name="checkmark-done-outline"></ion-icon>
                        Incidente atendido
                    </strong>
                `;
            }

            // Botón de informe: solo JEFE
            if (rolActual === "JEFE") {
                if (incidente.informe_id) {
                    botonInforme = `
                        <br>
                        <button onclick="verInforme(${incidente.informe_id})">
                            📄 Ver informe
                        </button>
                    `;
                } else {
                    botonInforme = `
                        <br>
                        <button onclick="abrirSubirInforme(${incidente.id}, '${incidente.codigo}')">
                            📄 Subir informe
                        </button>
                    `;
                }
            }

            let tiempos = "";
            if (incidente.tiempo_respuesta_minutos !== null) {
                tiempos += `🚒 <strong>Tiempo de respuesta:</strong> ${formatearMinutos(incidente.tiempo_respuesta_minutos)}<br>`;
            }
            if (incidente.tiempo_atencion_minutos !== null) {
                tiempos += `⏱️ <strong>Tiempo de atención:</strong> ${formatearMinutos(incidente.tiempo_atencion_minutos)}<br>`;
            }

            marcador.bindPopup(`
                <strong>🔥 ${incidente.codigo}</strong><br><br>

                <strong>Tipo:</strong> ${incidente.tipo}<br>
                <strong>Estado:</strong> ${incidente.estado}<br>
                <strong>Descripción:</strong> ${incidente.descripcion || "Sin descripción"}<br><br>

                📍 ${incidente.latitud.toFixed(6)}, ${incidente.longitud.toFixed(6)}<br>
                🚒 <strong>Distancia a estación:</strong> ${(incidente.distancia_estacion_metros / 1000).toFixed(2)} km
                <br><br>
                ${tiempos}
                ${botonesEstado}
                ${botonInforme}
            `);

        });

} catch (error) {

    console.error(
            "No se pudieron cargar los incidentes:",
            error
    );
}
}

// ============================================
// CAMBIAR ESTADO DEL INCIDENTE
// ============================================

async function cambiarEstadoIncidente(incidenteId, nuevoEstado) {

    console.log(
        "Cambiando incidente:",
        incidenteId,
        "a:",
        nuevoEstado
    );

    try {

        const respuesta = await fetch(
            `${API}/api/incidentes/${incidenteId}/estado`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json"
                },

                credentials: "include",

                body: JSON.stringify({
                    estado: nuevoEstado
                })
            }
        );

        const resultado = await respuesta.json();

        console.log(
            "Respuesta cambio de estado:",
            resultado
        );

        if (!respuesta.ok) {

            alert(
                "❌ No se pudo cambiar el estado:\n" +
                resultado.error
            );

            return;
        }

        alert(
            "✅ Incidente " +
            resultado.incidente.codigo +
            " cambiado a " +
            resultado.incidente.estado
        );

        // Cambiar icono del marcador
        const marcador = marcadoresIncidentes[incidenteId];

        if (marcador) {

            marcador.setIcon(
                obtenerIconoIncidente(
                    resultado.incidente.estado
                )
            );

        }
        // Recargar los incidentes
        cargarIncidentes();

    } catch (error) {

        console.error(
            "Error cambiando estado:",
            error
        );

        alert(
            "❌ No se pudo conectar con el backend."
        );
    }
}

// ============================================
// ICONO ESTACIÓN DE BOMBEROS
// ============================================


const iconoEstacionBomberos = L.divIcon({
    className: "marcador-estacion",
    html: `
        <div class="icono-estacion">
            <ion-icon name="business-outline"></ion-icon>
        </div>
    `,
    iconSize: [50, 50],
    iconAnchor: [25, 25],
    popupAnchor: [0, -25]
});

// ============================================
// CARGAR ESTACIONES DE BOMBEROS
// ============================================

async function cargarEstacionesBomberos() {

    try {

        const respuesta = await fetch(
            `${API}/api/estaciones-bomberos`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        const resultado = await respuesta.json();

        console.log("Estaciones recibidas:", resultado);

        if (!respuesta.ok) {

            console.error(
                "Error cargando estaciones:",
                resultado.error
            );

            return;
        }

        resultado.estaciones.forEach((estacion) => {

            const marcador = L.marker(
                [
                    estacion.latitud,
                    estacion.longitud
                ],
                {
                    icon: iconoEstacionBomberos
                }
            ).addTo(map);

            marcador.bindPopup(`
                <div class="popup-estacion">

                    <h3>🔥 ${estacion.nombre}</h3>

                    <p>
                        <strong>📍 Dirección:</strong><br>
                        ${estacion.direccion || "Sin dirección"}
                    </p>

                    <p>
                        <strong>📞 Teléfono:</strong><br>
                        ${estacion.telefono || "Sin teléfono"}
                    </p>

                    <p>
                        📍 ${estacion.latitud.toFixed(6)},
                        ${estacion.longitud.toFixed(6)}
                    </p>

                </div>
            `);

        });

    } catch (error) {

        console.error(
            "No se pudieron cargar las estaciones:",
            error
        );

    }
}
