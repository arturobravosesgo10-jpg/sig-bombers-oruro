
import os

from flask import Blueprint, request, session, send_from_directory
from werkzeug.utils import secure_filename

from database.conexion import conectar_db
from utils.permisos import requiere_rol


informes_bp = Blueprint("informes", __name__)

# Mantener la carpeta de informes dentro del backend.
CARPETA_INFORMES = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "informes"
)
os.makedirs(CARPETA_INFORMES, exist_ok=True)


@informes_bp.route("/api/informes", methods=["POST"])
@requiere_rol("JEFE")
def subir_informe():
    try:
        incidente_id = request.form.get("incidente_id")
        archivo = request.files.get("archivo")

        if not incidente_id or not archivo:
            return {
                "error": "El incidente y el archivo PDF son obligatorios"
            }, 400

        if archivo.filename == "":
            return {
                "error": "No se seleccionó ningún archivo"
            }, 400

        extension = archivo.filename.rsplit(".", 1)[-1].lower()

        if extension != "pdf":
            return {
                "error": "Solo se permiten archivos PDF"
            }, 400

        nombre_archivo = secure_filename(archivo.filename)

        if not nombre_archivo:
            return {
                "error": "El nombre del archivo no es válido"
            }, 400

        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT id
            FROM incidentes
            WHERE id = %s
        """, (incidente_id,))

        incidente = cursor.fetchone()

        if not incidente:
            cursor.close()
            conexion.close()

            return {
                "error": "El incidente no existe"
            }, 404

        # Guardar el archivo después de comprobar que existe el incidente.
        ruta_archivo = os.path.join(
            CARPETA_INFORMES,
            nombre_archivo
        )
        archivo.save(ruta_archivo)

        cursor.execute("""
            INSERT INTO informes
            (incidente_id, subido_por, archivo_pdf)
            VALUES (%s, %s, %s)
            RETURNING
                id,
                incidente_id,
                subido_por,
                archivo_pdf,
                fecha_subida;
        """, (
            incidente_id,
            session["usuario_id"],
            nombre_archivo
        ))

        informe = cursor.fetchone()

        conexion.commit()

        cursor.close()
        conexion.close()

        return {
            "mensaje": "Informe subido correctamente",
            "informe": {
                "id": informe[0],
                "incidente_id": informe[1],
                "subido_por": informe[2],
                "archivo_pdf": informe[3],
                "fecha_subida": (
                    informe[4].isoformat()
                    if informe[4] else None
                )
            }
        }, 201

    except Exception as e:
        return {"error": str(e)}, 500


@informes_bp.route("/api/informes/<int:informe_id>", methods=["GET"])
@requiere_rol("JEFE")
def obtener_informe(informe_id):
    try:
        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT archivo_pdf
            FROM informes
            WHERE id = %s
        """, (informe_id,))

        informe = cursor.fetchone()

        cursor.close()
        conexion.close()

        if not informe:
            return {"error": "El informe no existe"}, 404

        return send_from_directory(
            CARPETA_INFORMES,
            informe[0],
            as_attachment=False
        )

    except Exception as e:
        return {"error": str(e)}, 500

@informes_bp.route("/api/informes", methods=["GET"])
@requiere_rol("JEFE")
def listar_informes():
    try:
        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT
                inf.id,
                inf.incidente_id,
                inf.archivo_pdf,
                inf.fecha_subida,
                i.codigo,
                i.tipo,
                i.fecha_hora,
                ST_Y(i.ubicacion) AS latitud,
                ST_X(i.ubicacion) AS longitud
            FROM informes inf
            INNER JOIN incidentes i
                ON inf.incidente_id = i.id
            ORDER BY inf.fecha_subida DESC;
        """)

        filas = cursor.fetchall()

        informes = []

        for fila in filas:
            informes.append({
                "id": fila[0],
                "incidente_id": fila[1],
                "archivo_pdf": fila[2],
                "fecha_subida": fila[3].isoformat() if fila[3] else None,
                "codigo": fila[4],
                "tipo": fila[5],
                "fecha_hora": fila[6].isoformat() if fila[6] else None,
                "latitud": float(fila[7]),
                "longitud": float(fila[8])
            })

        cursor.close()
        conexion.close()

        return {
            "total": len(informes),
            "informes": informes
        }, 200

    except Exception as e:
        return {"error": str(e)}, 500
