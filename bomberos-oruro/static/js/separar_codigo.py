from pathlib import Path
import re
import shutil

base = Path.cwd()
original = base / "app.js"
backup = base / "app respaldo antes de separar.js"

if not original.exists():
    raise SystemExit("ERROR: No se encuentra app.js.")

if not backup.exists():
    shutil.copy2(original, backup)

codigo = original.read_text(encoding="utf-8-sig")

patron = re.compile(
    r"(?m)^// =+\r?\n// (.*?)\r?\n// =+\r?\n"
)
coincidencias = list(patron.finditer(codigo))

if not coincidencias:
    raise SystemExit("ERROR: No se reconocieron las secciones del código.")

archivos = {
    "config": [],
    "mapa": [],
    "estadisticas": [],
    "incidentes": [],
    "autenticacion": [],
    "notificaciones": [],
    "informes": [],
    "postulaciones": [],
    "menu": [],
}

destino = "config"

def asignar(titulo):
    t = titulo.upper()

    if "CONFIGURACIÓN" in t:
        return "config"
    if "CREAR MAPA" in t or "MARCADOR DE ORURO" in t or "ESTOY AQUÍ" in t:
        return "mapa"
    if "BOTÓN REPORTAR INCENDIO" in t:
        return "estadisticas"
    if "ICONOS DE INCIDENTES" in t or "VARIABLES" == t:
        return "incidentes"
    if any(x in t for x in [
        "SELECCIONAR LUGAR DEL INCENDIO",
        "CONFIRMAR INCENDIO",
        "CARGAR INCIDENTES DEL BACKEND",
        "CAMBIAR ESTADO DEL INCIDENTE",
        "ICONO ESTACIÓN DE BOMBEROS",
        "CARGAR ESTACIONES DE BOMBEROS",
    ]):
        return "incidentes"
    if any(x in t for x in [
        "LOGIN",
        "INICIAR SESIÓN",
        "COMPROBAR SESIÓN",
        "CERRAR SESIÓN",
        "REGISTRO DE CIUDADANOS",
    ]):
        return "autenticacion"
    if "NOTIFICACIONES" in t:
        return "notificaciones"
    if "INFORMES PDF" in t:
        return "informes"
    if "POSTULACIONES" in t:
        return "postulaciones"
    if "MENÚ LATERAL" in t or "ABRIR MENÚ" in t:
        return "menu"

    return None

for i, m in enumerate(coincidencias):
    inicio = m.start()
    fin = coincidencias[i + 1].start() if i + 1 < len(coincidencias) else len(codigo)
    bloque = codigo[inicio:fin]
    nuevo_destino = asignar(m.group(1).strip())

    if nuevo_destino:
        destino = nuevo_destino

    archivos[destino].append(bloque)

# La comprobación de sesión se ejecutará al final, después de cargar los archivos.
for nombre in archivos:
    archivos[nombre] = [
        re.sub(r"(?m)^\s*comprobarSesion\(\);\s*$", "", bloque)
        for bloque in archivos[nombre]
    ]

# Configuración compatible con scripts clásicos: sin import/export.
archivos["config"] = [
    """
// Configuración general
const API = "http://127.0.0.1:5000";
let rolActual = null;
const oruro = [-17.9667, -67.1167];
"""
]

# Evitar duplicar el mapa: se conserva la sección CREAR MAPA en mapa.js.
for nombre, bloques in archivos.items():
    ruta = base / f"{nombre}.js"
    contenido = "\n\n".join(b.strip() for b in bloques if b.strip())

    if nombre == "mapa":
        contenido = contenido.replace(
            'import { COORDENADAS_ORURO } from "./config.js";',
            ""
        )
        contenido = contenido.replace("COORDENADAS_ORURO", "oruro")
        contenido = contenido.replace("export const map =", "const map =")
        contenido = contenido.replace("export const marcadorOruro =", "const marcadorOruro =")
        contenido = contenido.replace("export function inicializarMapa()", "function inicializarMapa()")

    ruta.write_text(contenido + "\n", encoding="utf-8")

(base / "app.js").write_text(
    "// Inicio de SIG Bombers\ncomprobarSesion();\n",
    encoding="utf-8"
)

print("\nSeparación realizada. Archivos generados:")
for nombre in archivos:
    ruta = base / f"{nombre}.js"
    print(f"  {ruta.name}: {ruta.stat().st_size} bytes")

print("\nRespaldo original:", backup.name)
print("IMPORTANTE: revisa el orden de los scripts HTML antes de probar.")
