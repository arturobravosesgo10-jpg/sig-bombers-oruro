// ============================================
// POSTULACIONES
// ============================================

const btnPostulaciones = document.getElementById("btnPostulaciones");
const panelPostulaciones = document.getElementById("panelPostulaciones");
const btnCerrarPostulaciones = document.getElementById("btnCerrarPostulaciones");
const btnPostularse = document.getElementById("btnPostularse");
const mensajePostulacion = document.getElementById("mensajePostulacion");
const listaMisPostulaciones = document.getElementById("listaMisPostulaciones");
const listaPostulacionesJefe = document.getElementById("listaPostulacionesJefe");
const vistaCiudadanoPostulacion = document.getElementById("vistaCiudadanoPostulacion");
const vistaJefePostulaciones = document.getElementById("vistaJefePostulaciones");



// Ciudadano: enviar postulación
btnPostularse.addEventListener("click", async () => {
    btnPostularse.disabled = true;
    btnPostularse.textContent = "Enviando...";
    mensajePostulacion.textContent = "";

    try {
        const respuesta = await fetch(`${API}/api/postulaciones`, {
            method: "POST",
            credentials: "include"
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            mensajePostulacion.textContent = resultado.error || "No se pudo enviar la postulación.";
            mensajePostulacion.style.color = "#d32f2f";
            return;
        }

        mensajePostulacion.textContent = "Postulación enviada correctamente.";
        mensajePostulacion.style.color = "#2e7d32";
        cargarMisPostulaciones();

    } catch (error) {
        console.error("Error enviando postulación:", error);
        mensajePostulacion.textContent = "No se pudo conectar con el servidor.";
        mensajePostulacion.style.color = "#d32f2f";
    } finally {
        btnPostularse.disabled = false;
        btnPostularse.textContent = "Enviar postulación";
    }
});

// Ciudadano: cargar sus postulaciones
async function cargarMisPostulaciones() {
    listaMisPostulaciones.innerHTML = "<p>Cargando...</p>";

    try {
        const respuesta = await fetch(`${API}/api/postulaciones/mias`, {
            method: "GET",
            credentials: "include"
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            listaMisPostulaciones.innerHTML = `<p>${resultado.error}</p>`;
            return;
        }

        if (resultado.postulaciones.length === 0) {
            listaMisPostulaciones.innerHTML = "<p>Aún no has enviado ninguna postulación.</p>";
            return;
        }

        listaMisPostulaciones.innerHTML = "";

        resultado.postulaciones.forEach((p) => {
            const div = document.createElement("div");
            let clase = "";
            if (p.estado === "ACEPTADA") clase = "aceptada";
            if (p.estado === "RECHAZADA") clase = "rechazada";

            div.className = `postulacion-item ${clase}`;
            div.innerHTML = `
                <strong>Estado: ${p.estado}</strong>
                <span>Fecha: ${new Date(p.fecha_postulacion).toLocaleString()}</span>
                ${p.observaciones ? `<br><span>Observaciones: ${p.observaciones}</span>` : ""}
            `;
            listaMisPostulaciones.appendChild(div);
        });

    } catch (error) {
        console.error(error);
        listaMisPostulaciones.innerHTML = "<p>Error al cargar postulaciones.</p>";
    }
}

// Jefe: cargar todas las postulaciones
async function cargarPostulacionesJefe() {
    listaPostulacionesJefe.innerHTML = "<p>Cargando postulaciones...</p>";

    try {
        const respuesta = await fetch(`${API}/api/postulaciones`, {
            method: "GET",
            credentials: "include"
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            listaPostulacionesJefe.innerHTML = `<p>${resultado.error}</p>`;
            return;
        }

        if (resultado.postulaciones.length === 0) {
            listaPostulacionesJefe.innerHTML = "<p>No hay postulaciones.</p>";
            return;
        }

        listaPostulacionesJefe.innerHTML = "";

        resultado.postulaciones.forEach((p) => {
            const div = document.createElement("div");
            let clase = "";
            if (p.estado === "ACEPTADA") clase = "aceptada";
            if (p.estado === "RECHAZADA") clase = "rechazada";

            div.className = `postulacion-item ${clase}`;

            let botones = "";
            if (p.estado === "PENDIENTE") {
                botones = `
                    <div class="postulacion-acciones">
                        <button class="btn-aceptar" onclick="resolverPostulacion(${p.id}, 'ACEPTADA')">
                            Aceptar
                        </button>
                        <button class="btn-rechazar" onclick="resolverPostulacion(${p.id}, 'RECHAZADA')">
                            Rechazar
                        </button>
                    </div>
                `;
            }

            div.innerHTML = `
                <strong>${p.usuario.nombre}</strong>
                <span>${p.usuario.email}</span><br>
                <span>${p.usuario.telefono || "Sin teléfono"}</span><br>
                <span>Estado: <strong>${p.estado}</strong></span><br>
                <span>Fecha: ${new Date(p.fecha_postulacion).toLocaleString()}</span>
                ${p.observaciones ? `<br><span>Observaciones: ${p.observaciones}</span>` : ""}
                ${botones}
            `;

            listaPostulacionesJefe.appendChild(div);
        });

    } catch (error) {
        console.error(error);
        listaPostulacionesJefe.innerHTML = "<p>Error al cargar postulaciones.</p>";
    }
}

// Jefe: aceptar o rechazar
async function resolverPostulacion(id, estado) {
    const observaciones = prompt(
        estado === "ACEPTADA"
            ? "Observaciones (opcional):"
            : "Motivo del rechazo (opcional):"
    );

    try {
        const respuesta = await fetch(`${API}/api/postulaciones/${id}/estado`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                estado: estado,
                observaciones: observaciones || ""
            })
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar la postulación.");
            return;
        }

        alert(resultado.mensaje);
        cargarPostulacionesJefe();

    } catch (error) {
        console.error(error);
        alert("No se pudo conectar con el servidor.");
    }
}

// ============================================
// MENÚ → POSTULACIONES
// ============================================

document
    .getElementById("menuPostulaciones")
    .addEventListener("click", () => {

        mostrarPanelMenu(
            "panelPostulaciones",
            "menuPostulaciones"
        );

        // Ciudadano
        if (rolActual === "CIUDADANO") {

            document
                .getElementById("vistaCiudadanoPostulacion")
                .classList.remove("oculto");

            document
                .getElementById("vistaJefePostulaciones")
                .classList.add("oculto");

            cargarMisPostulaciones();

        }

        // Jefe
        else if (rolActual === "JEFE") {

            document
                .getElementById("vistaCiudadanoPostulacion")
                .classList.add("oculto");

            document
                .getElementById("vistaJefePostulaciones")
                .classList.remove("oculto");

            cargarPostulacionesJefe();

        }

    });

// ============================================
// MENÚ → ESTADÍSTICAS
// ============================================

document
    .getElementById("menuEstadisticas")
    .addEventListener("click", () => {

        mostrarPanelMenu(
            "panelEstadisticas",
            "menuEstadisticas"
        );

        cargarEstadisticas();

    });
