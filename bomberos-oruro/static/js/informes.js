// ============================================
// INFORMES PDF
// ============================================

function abrirSubirInforme(incidenteId, codigo) {
    // Crear un input de archivo oculto
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
                alert("❌ Error al subir el informe:\n" + (resultado.error || "Error desconocido"));
                return;
            }

            alert("✅ Informe subido correctamente para " + codigo);

            // Recargar incidentes para actualizar el botón
            cargarIncidentes();

        } catch (error) {
            console.error("Error subiendo informe:", error);
            alert("❌ No se pudo conectar con el servidor.");
        }
    };

    input.click();
}

function verInforme(informeId) {
    // Abrir el PDF en una nueva pestaña
    window.open(`${API}/api/informes/${informeId}`, "_blank");
}
