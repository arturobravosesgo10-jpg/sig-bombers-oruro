// ============================================
// LOGIN
// ============================================

const formLogin = document.getElementById("formLogin");
const pantallaLogin = document.getElementById("pantallaLogin");
const aplicacion = document.getElementById("aplicacion");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const btnLogin = document.getElementById("btnLogin");
const mensajeLogin = document.getElementById("mensajeLogin");

const usuarioNombre = document.getElementById("usuarioNombre");
const btnCerrarSesion = document.getElementById("btnCerrarSesion");

// ============================================
// INICIAR SESIÓN
// ============================================

formLogin.addEventListener("submit", async (e) => {

    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        mensajeLogin.textContent = "Debes completar todos los campos.";
        return;
    }

    btnLogin.disabled = true;
    btnLogin.textContent = "INGRESANDO...";
    mensajeLogin.textContent = "";

    try {

        const respuesta = await fetch(
            `${API}/api/login`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                credentials: "include",

                body: JSON.stringify({
                    email: email,
                    password: password
                })
            }
        );

        const resultado = await respuesta.json();

        console.log("Respuesta login:", resultado);

        if (!respuesta.ok) {

            mensajeLogin.textContent =
                resultado.error || "Correo o contraseña incorrectos.";

            btnLogin.disabled = false;
            btnLogin.textContent = "INGRESAR";

            return;
        }

        // ====================================
        // LOGIN CORRECTO
        // ====================================

        console.log("Inicio de sesión exitoso");

        pantallaLogin.classList.add("oculto");
        aplicacion.classList.remove("oculto");


        setTimeout(() => {
            map.invalidateSize();
        }, 300);

        // Mostrar nombre del usuario
        if (resultado.usuario) {

            rolActual = resultado.usuario.rol;
            actualizarControlesPorRol();

            usuarioNombre.textContent =
                resultado.usuario.nombre ||
                resultado.usuario.email ||
                "Usuario";

        }

        // Cargar incidentes solamente después
        // de iniciar sesión
        cargarIncidentes();
        cargarEstacionesBomberos();

    } catch (error) {

        console.error("Error en login:", error);

        mensajeLogin.textContent =
            "No se pudo conectar con el servidor.";

    } finally {

        btnLogin.disabled = false;
        btnLogin.textContent = "INGRESAR";
    }

});

// ============================================
// COMPROBAR SESIÓN AL CARGAR LA PÁGINA
// ============================================

async function comprobarSesion() {

    try {

        const respuesta = await fetch(
            `${API}/api/sesion`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        const resultado = await respuesta.json();

        console.log("Sesión:", resultado);

        if (resultado.autenticado) {

            // Ocultar login
            pantallaLogin.classList.add("oculto");

            // Mostrar aplicación
            aplicacion.classList.remove("oculto");

            // Mostrar usuario correcto
            if (resultado.usuario) {

                rolActual = resultado.usuario.rol;
                actualizarControlesPorRol();

                usuarioNombre.textContent =
                    resultado.usuario.nombre ||
                    resultado.usuario.email ||
                    "Usuario";

                console.log(
                    "Usuario recuperado:",
                    resultado.usuario
                );
            }

            // Actualizar tamaño del mapa
            setTimeout(() => {
                map.invalidateSize();
            }, 300);

            // Cargar datos
            cargarIncidentes();
            cargarEstacionesBomberos();

        }

    } catch (error) {

        console.error(
            "Error comprobando sesión:",
            error
        );

    }
}

// ============================================
// CERRAR SESIÓN
// ============================================

btnCerrarSesion.addEventListener("click", async () => {

    try {

        const respuesta = await fetch(
            `${API}/api/logout`,
            {
                method: "POST",
                credentials: "include"
            }
        );

        console.log("Sesión cerrada");

    } catch (error) {

        console.error(
            "Error cerrando sesión:",
            error
        );

    }

    // Volver a la pantalla de login
    aplicacion.classList.add("oculto");
    pantallaLogin.classList.remove("oculto");
    rolActual = null;
    actualizarControlesPorRol();

    // Limpiar formulario
    emailInput.value = "";
    passwordInput.value = "";
    mensajeLogin.textContent = "";

});

// ============================================
// REGISTRO DE CIUDADANOS
// ============================================

const formRegistro = document.getElementById("formRegistro");
const btnRegistro = document.getElementById("btnRegistro");
const mensajeRegistro = document.getElementById("mensajeRegistro");

const mostrarRegistro = document.getElementById("mostrarRegistro");
const mostrarLogin = document.getElementById("mostrarLogin");
const volverLogin = document.getElementById("volverLogin");

// Cambiar a formulario de registro
mostrarRegistro.addEventListener("click", (e) => {
    e.preventDefault();

    formLogin.classList.add("oculto");
    document.querySelector(".enlace-registro").classList.add("oculto");
    mensajeLogin.textContent = "";

    formRegistro.classList.remove("oculto");
    volverLogin.classList.remove("oculto");
    mensajeRegistro.textContent = "";
});

// Volver al formulario de login
mostrarLogin.addEventListener("click", (e) => {
    e.preventDefault();

    formRegistro.classList.add("oculto");
    volverLogin.classList.add("oculto");
    mensajeRegistro.textContent = "";

    formLogin.classList.remove("oculto");
    document.querySelector(".enlace-registro").classList.remove("oculto");
});

// Enviar registro
formRegistro.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = document.getElementById("regNombre").value.trim();
    const telefono = document.getElementById("regTelefono").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const password2 = document.getElementById("regPassword2").value;

    // Validaciones básicas
    if (!nombre || !email || !password) {
        mensajeRegistro.textContent = "Nombre, email y contraseña son obligatorios.";
        return;
    }

    if (password.length < 6) {
        mensajeRegistro.textContent = "La contraseña debe tener al menos 6 caracteres.";
        return;
    }

    if (password !== password2) {
        mensajeRegistro.textContent = "Las contraseñas no coinciden.";
        return;
    }

    btnRegistro.disabled = true;
    btnRegistro.textContent = "CREANDO CUENTA...";
    mensajeRegistro.textContent = "";

    try {
        // 1. Registrar usuario
        const respuestaRegistro = await fetch(`${API}/api/registro`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                nombre: nombre,
                telefono: telefono,
                email: email,
                password: password
            })
        });

        const resultadoRegistro = await respuestaRegistro.json();

        if (!respuestaRegistro.ok) {
            mensajeRegistro.textContent = resultadoRegistro.error || "No se pudo registrar.";
            btnRegistro.disabled = false;
            btnRegistro.textContent = "CREAR CUENTA";
            return;
        }

        // 2. Login automático después del registro
        const respuestaLogin = await fetch(`${API}/api/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const resultadoLogin = await respuestaLogin.json();

        if (!respuestaLogin.ok) {
            mensajeRegistro.textContent = "Cuenta creada, pero no se pudo iniciar sesión. Intenta ingresar manualmente.";
            btnRegistro.disabled = false;
            btnRegistro.textContent = "CREAR CUENTA";
            return;
        }

        // 3. Entrar a la aplicación
        pantallaLogin.classList.add("oculto");
        aplicacion.classList.remove("oculto");

        setTimeout(() => {
            map.invalidateSize();
        }, 300);

        if (resultadoLogin.usuario) {
            rolActual = resultadoLogin.usuario.rol;
            actualizarControlesPorRol();
            usuarioNombre.textContent = resultadoLogin.usuario.nombre || resultadoLogin.usuario.email;
        }

        cargarIncidentes();
        cargarEstacionesBomberos();

    } catch (error) {
        console.error("Error en registro:", error);
        mensajeRegistro.textContent = "No se pudo conectar con el servidor.";
    } finally {
        btnRegistro.disabled = false;
        btnRegistro.textContent = "CREAR CUENTA";
    }
});
