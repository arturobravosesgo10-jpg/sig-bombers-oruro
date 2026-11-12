// ============================================
// MENÚ LATERAL
// ============================================

const btnMenu = document.getElementById("btnMenu");
const contenedorMenu = document.getElementById("contenedorMenu");
const menuLateral = document.getElementById("menuLateral");
const panelContenido = document.getElementById("panelContenido");
const menuOverlay = document.getElementById("menuOverlay");
const btnCerrarMenu = document.getElementById("btnCerrarMenu");

// ============================================
// ABRIR MENÚ
// ============================================

function abrirMenu() {

    contenedorMenu.classList.remove("oculto");
    menuOverlay.classList.remove("oculto");

    // Mostrar notificaciones por defecto
    mostrarPanelMenu(
        "panelNotificaciones",
        "menuNotificaciones"
    );

    cargarNotificaciones();
}


function cerrarMenu() {

    contenedorMenu.classList.add("oculto");
    menuOverlay.classList.add("oculto");

    document.querySelectorAll(".menu-item").forEach((item) => {
        item.classList.remove("activo");
    });

    cerrarTodosLosPaneles();

    // Recuperar correctamente el tamaño del mapa
    setTimeout(() => {
        map.invalidateSize(true);
    }, 300);
}

// ============================================
// CERRAR TODOS LOS PANELES
// ============================================

function cerrarTodosLosPaneles() {

    document.querySelectorAll(".contenido-menu").forEach((panel) => {
        panel.classList.add("oculto");
    });

}

// ============================================
// MOSTRAR PANEL SELECCIONADO
// ============================================

function mostrarPanelMenu(idPanel, idMenu) {

    // Ocultar todos los paneles
    cerrarTodosLosPaneles();

    // Quitar activo de todas las opciones
    document.querySelectorAll(".menu-item").forEach((item) => {
        item.classList.remove("activo");
    });

    // Mostrar panel seleccionado
    const panel = document.getElementById(idPanel);

    if (panel) {
        panel.classList.remove("oculto");
    }

    // Marcar opción seleccionada
    const menu = document.getElementById(idMenu);

    if (menu) {
        menu.classList.add("activo");
    }

}

// ============================================
// BOTÓN DEL MENÚ
// ============================================

btnMenu.addEventListener("click", abrirMenu);

// ============================================
// BOTÓN X
// ============================================

btnCerrarMenu.addEventListener("click", cerrarMenu);

// ============================================
// CLIC EN EL FONDO OSCURO
// ============================================

menuOverlay.addEventListener("click", cerrarMenu);

// ============================================
// PANEL DE INFORMES
// ============================================

const menuInformes = document.getElementById("menuInformes");

if (menuInformes) {
    menuInformes.addEventListener("click", () => {
        mostrarPanelMenu("panelInformes", "menuInformes");
        cargarInformes();
    });
}
