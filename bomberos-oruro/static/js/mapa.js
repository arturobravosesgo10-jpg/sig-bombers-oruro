// ============================================
// CREAR MAPA
// ============================================

const map = L.map("map").setView(oruro, 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
}).addTo(map);

// ============================================
// MARCADOR DE ORURO
// ============================================

const marcadorOruro = L.marker(oruro)
    .addTo(map)
    .bindPopup(`
        <strong>📍 Oruro</strong><br>
        Centro de referencia del sistema SIG
    `);

// ============================================
// BOTÓN "ESTOY AQUÍ"
// ============================================

const btnUbicacion = document.getElementById("btnUbicacion");

btnUbicacion.addEventListener("click", () => {

    if (!navigator.geolocation) {
        alert("Tu navegador no permite obtener la ubicación.");
        return;
    }

    btnUbicacion.textContent = "📍 Obteniendo ubicación...";

    navigator.geolocation.getCurrentPosition(

        (position) => {

            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            console.log("Latitud:", lat);
            console.log("Longitud:", lng);

            map.setView([lat, lng], 16);

            L.marker([lat, lng])
                .addTo(map)
                .bindPopup(`
                    <strong>📍 Estás aquí</strong><br>
                    Latitud: ${lat.toFixed(6)}<br>
                    Longitud: ${lng.toFixed(6)}
                `)
                .openPopup();

            btnUbicacion.textContent = "📍 Mi ubicación";
        },

        (error) => {

            console.error(error);

            alert(
                "No pudimos obtener tu ubicación. " +
                "Asegúrate de permitir el acceso a tu ubicación."
            );

            btnUbicacion.textContent = "📍 Estoy aquí";
        }
    );
});
