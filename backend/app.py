from flask import Flask, request, session, send_from_directory
from flask_cors import CORS
from database.conexion import conectar_db
from utils.permisos import requiere_rol
from routes.auth import auth_bp
from routes.incidentes import incidentes_bp
from routes.informes import informes_bp


import os
from werkzeug.utils import secure_filename

app = Flask(__name__)

# URL del frontend
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://127.0.0.1:5001"
)

# ConfiguraciÃ³n CORS
CORS(
    app,
    supports_credentials=True,
    origins=[
        "http://127.0.0.1:5001",
        FRONTEND_URL
    ]
)

# Clave secreta
app.secret_key = os.getenv(
    "SECRET_KEY",
    "clave-local-solo-para-desarrollo"
)

# ConfiguraciÃ³n de sesiones
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="None",
    SESSION_COOKIE_SECURE=True
)

app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

CARPETA_INFORMES = os.path.join(app.root_path, "informes")
os.makedirs(CARPETA_INFORMES, exist_ok=True)

EXTENSIONES_PERMITIDAS = {"pdf"}

app.register_blueprint(auth_bp)
app.register_blueprint(incidentes_bp)
app.register_blueprint(informes_bp)


@app.route("/")
def inicio():
    return "Backend SIG Bombers funcionando ðŸš’"


@app.route("/prueba-db")
def prueba_db():
    try:
        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute("SELECT version();")
        version = cursor.fetchone()

        cursor.close()
        conexion.close()

        return {
            "mensaje": "ConexiÃ³n a PostgreSQL exitosa",
            "postgresql": version[0]
        }

    except Exception as e:
        return {
            "error": str(e)
        }, 500


@app.route("/api/incidentes", methods=["POST"])
@requiere_rol("CIUDADANO")
def crear_incidente():
    try:
        datos = request.get_json(silent=True) or {}

        tipo = datos.get("tipo")
        descripcion = datos.get("descripcion")
        latitud = datos.get("latitud")
        longitud = datos.get("longitud")

        if not tipo or latitud is None or longitud is None:
            return {
                "error": "Tipo, latitud y longitud son obligatorios"
            }, 400

        reportado_por = session["usuario_id"]

        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT COALESCE(MAX(id), 0) + 1
            FROM incidentes
        """)

        siguiente_id = cursor.fetchone()[0]
        codigo = f"INCIDENTE-{siguiente_id:03d}"

        cursor.execute("""
            INSERT INTO incidentes
            (codigo, tipo, descripcion, reportado_por, ubicacion, estado)
            VALUES (
                %s,
                %s,
                %s,
                %s,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                'REPORTADO'
            )
            RETURNING id, codigo, tipo, descripcion, estado, fecha_hora;
        """, (
            codigo,
            tipo,
            descripcion,
            reportado_por,
            longitud,
            latitud
        ))

        incidente = cursor.fetchone()
        # Crear notificaciones para bomberos y jefes
        cursor.execute("""
            SELECT id
            FROM usuarios
            WHERE rol IN ('BOMBERO', 'JEFE')
        """)

        usuarios_notificar = cursor.fetchall()

        mensaje = f"ðŸš¨ Nuevo incidente reportado: {codigo}"

        for usuario in usuarios_notificar:
            cursor.execute("""
                INSERT INTO notificaciones
                (incidente_id, destinatario_id, mensaje)
                VALUES (%s, %s, %s)
            """, (
                incidente[0],
                usuario[0],
                mensaje
            ))

        conexion.commit()

        cursor.close()
        conexion.close()

        return {
            "mensaje": "Incidente reportado correctamente",
            "incidente": {
                "id": incidente[0],
                "codigo": incidente[1],
                "tipo": incidente[2],
                "descripcion": incidente[3],
                "estado": incidente[4],
                "fecha_hora": incidente[5]
            }
        }, 201

    except Exception as e:
        return {
            "error": str(e)
        }, 500


@app.route("/api/incidentes", methods=["GET"])
@requiere_rol("CIUDADANO", "BOMBERO", "JEFE")
def obtener_incidentes():
    try:
        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT
                i.id,
                i.codigo,
                i.tipo,
                i.descripcion,
                i.estado,
                i.fecha_hora,
                i.reportado_por,
                u.nombre,
                ST_Y(i.ubicacion) AS latitud,
                ST_X(i.ubicacion) AS longitud,
                ROUND(
                    ST_Distance(
                        ST_Transform(i.ubicacion, 32719),
                        ST_Transform(e.ubicacion, 32719)
                    )::numeric,
                    2
                ) AS distancia_estacion_metros,
                i.fecha_en_camino,
                i.fecha_atendido,
                ROUND((EXTRACT(EPOCH FROM (i.fecha_en_camino - i.fecha_hora)) / 60.0)::numeric, 2) AS tiempo_respuesta_minutos,
                ROUND((EXTRACT(EPOCH FROM (i.fecha_atendido - i.fecha_en_camino)) / 60.0)::numeric, 2) AS tiempo_atencion_minutos,
                inf.id AS informe_id,
                inf.archivo_pdf
            FROM incidentes i
            LEFT JOIN usuarios u ON i.reportado_por = u.id
            LEFT JOIN estaciones_bomberos e ON TRUE
            LEFT JOIN informes inf ON inf.incidente_id = i.id
            ORDER BY i.fecha_hora DESC;
        """)

        filas = cursor.fetchall()

        cursor.close()
        conexion.close()

        incidentes = []

        for fila in filas:
            incidentes.append({
                "id": fila[0],
                "codigo": fila[1],
                "tipo": fila[2],
                "descripcion": fila[3],
                "estado": fila[4],
                "fecha_hora": fila[5].isoformat() if fila[5] else None,
                "reportado_por": fila[6],
                "nombre_reportante": fila[7],
                "latitud": float(fila[8]),
                "longitud": float(fila[9]),
                "distancia_estacion_metros": float(fila[10]),
                "fecha_en_camino": fila[11].isoformat() if fila[11] else None,
                "fecha_atendido": fila[12].isoformat() if fila[12] else None,
                "tiempo_respuesta_minutos": float(fila[13]) if fila[13] is not None else None,
                "tiempo_atencion_minutos": float(fila[14]) if fila[14] is not None else None,
                "informe_id": fila[15],
                "archivo_pdf": fila[16]
            })

        return {
            "total": len(incidentes),
            "incidentes": incidentes
        }, 200

    except Exception as e:
        return {
            "error": str(e)
        }, 500

@app.route("/api/estaciones-bomberos", methods=["GET"])
@requiere_rol("CIUDADANO", "BOMBERO", "JEFE")
def obtener_estaciones_bomberos():
    try:
        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT
                id,
                nombre,
                direccion,
                telefono,
                ST_Y(ubicacion) AS latitud,
                ST_X(ubicacion) AS longitud
            FROM estaciones_bomberos
            ORDER BY id;
        """)

        filas = cursor.fetchall()

        cursor.close()
        conexion.close()

        estaciones = []

        for fila in filas:
            estaciones.append({
                "id": fila[0],
                "nombre": fila[1],
                "direccion": fila[2],
                "telefono": fila[3],
                "latitud": float(fila[4]),
                "longitud": float(fila[5])
            })

        return {
            "total": len(estaciones),
            "estaciones": estaciones
        }, 200

    except Exception as e:
        return {
            "error": str(e)
        }, 500


@app.route("/api/notificaciones/<int:notificacion_id>/leer", methods=["PUT"])
@requiere_rol("CIUDADANO", "BOMBERO", "JEFE")
def marcar_notificacion_leida(notificacion_id):
    try:
        usuario_id = session["usuario_id"]

        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute("""
            UPDATE notificaciones
            SET leida = TRUE
            WHERE id = %s
              AND destinatario_id = %s
            RETURNING id, incidente_id, leida;
        """, (
            notificacion_id,
            usuario_id
        ))

        notificacion = cursor.fetchone()

        if not notificacion:
            cursor.close()
            conexion.close()

            return {
                "error": "La notificaciÃ³n no existe o no te pertenece"
            }, 404

        conexion.commit()

        cursor.close()
        conexion.close()

        return {
            "mensaje": "NotificaciÃ³n marcada como leÃ­da",
            "notificacion": {
                "id": notificacion[0],
                "incidente_id": notificacion[1],
                "leida": notificacion[2]
            }
        }, 200

    except Exception as e:
        return {
            "error": str(e)
        }, 500

@app.route("/api/notificaciones", methods=["GET"])
@requiere_rol("CIUDADANO", "BOMBERO", "JEFE")
def obtener_notificaciones():
    try:
        usuario_id = session["usuario_id"]

        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT
                n.id,
                n.incidente_id,
                i.codigo,
                i.estado,
                n.mensaje,
                n.leida,
                n.fecha_envio
            FROM notificaciones n
            JOIN incidentes i
                ON n.incidente_id = i.id
            WHERE n.destinatario_id = %s
            ORDER BY n.fecha_envio DESC;
        """, (usuario_id,))

        filas = cursor.fetchall()

        cursor.close()
        conexion.close()

        notificaciones = []

        for fila in filas:
            notificaciones.append({
                "id": fila[0],
                "incidente_id": fila[1],
                "codigo_incidente": fila[2],
                "estado": fila[3],
                "mensaje": fila[4],
                "leida": fila[5],
                "fecha_envio": fila[6].isoformat() if fila[6] else None
            })

        return {
            "total": len(notificaciones),
            "notificaciones": notificaciones
        }, 200

    except Exception as e:
        return {
            "error": str(e)
        }, 500


@app.route("/api/estadisticas", methods=["GET"])
@requiere_rol("JEFE")
def obtener_estadisticas():
    try:
        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT
                COUNT(*) AS total_incidentes,
                COUNT(*) FILTER (
                    WHERE fecha_hora >= date_trunc('month', CURRENT_DATE)
                ) AS incidentes_mes,
                COUNT(*) FILTER (WHERE estado = 'REPORTADO') AS reportados,
                COUNT(*) FILTER (WHERE estado = 'EN_CAMINO') AS en_camino,
                COUNT(*) FILTER (WHERE estado = 'ATENDIDO') AS atendidos,
                ROUND(
                    AVG(EXTRACT(EPOCH FROM (fecha_en_camino - fecha_hora)) / 60.0)::numeric,
                    2
                ) AS promedio_respuesta_minutos,
                ROUND(
                    AVG(EXTRACT(EPOCH FROM (fecha_atendido - fecha_en_camino)) / 60.0)::numeric,
                    2
                ) AS promedio_atencion_minutos
            FROM incidentes;
        """)

        resumen = cursor.fetchone()

        cursor.execute("""
            SELECT tipo, COUNT(*) AS cantidad
            FROM incidentes
            GROUP BY tipo
            ORDER BY cantidad DESC, tipo;
        """)

        por_tipo = [
            {"tipo": fila[0], "cantidad": fila[1]}
            for fila in cursor.fetchall()
        ]

        cursor.close()
        conexion.close()

        return {
            "resumen": {
                "total_incidentes": resumen[0],
                "incidentes_mes": resumen[1],
                "reportados": resumen[2],
                "en_camino": resumen[3],
                "atendidos": resumen[4],
                "promedio_respuesta_minutos": float(resumen[5]) if resumen[5] is not None else None,
                "promedio_atencion_minutos": float(resumen[6]) if resumen[6] is not None else None
            },
            "por_tipo": por_tipo
        }, 200

    except Exception as e:
        return {"error": str(e)}, 500

# ============================================
# POSTULACIONES
# ============================================

@app.route("/api/postulaciones", methods=["POST"])
@requiere_rol("CIUDADANO")
def crear_postulacion():
    try:
        usuario_id = session["usuario_id"]

        conexion = conectar_db()
        cursor = conexion.cursor()

        # Verificar si ya tiene una postulaciÃ³n pendiente
        cursor.execute("""
            SELECT id FROM postulaciones
            WHERE usuario_id = %s AND estado = 'PENDIENTE'
        """, (usuario_id,))

        if cursor.fetchone():
            cursor.close()
            conexion.close()
            return {"error": "Ya tienes una postulaciÃ³n pendiente"}, 409

        # Verificar si ya es bombero
        cursor.execute("SELECT rol FROM usuarios WHERE id = %s", (usuario_id,))
        rol = cursor.fetchone()[0]

        if rol == "BOMBERO":
            cursor.close()
            conexion.close()
            return {"error": "Ya eres bombero"}, 400

        cursor.execute("""
            INSERT INTO postulaciones (usuario_id, estado)
            VALUES (%s, 'PENDIENTE')
            RETURNING id, estado, fecha_postulacion;
        """, (usuario_id,))

        postulacion = cursor.fetchone()
        conexion.commit()

        cursor.close()
        conexion.close()

        return {
            "mensaje": "PostulaciÃ³n enviada correctamente",
            "postulacion": {
                "id": postulacion[0],
                "estado": postulacion[1],
                "fecha_postulacion": postulacion[2].isoformat()
            }
        }, 201

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/api/postulaciones/mias", methods=["GET"])
@requiere_rol("CIUDADANO")
def mis_postulaciones():
    try:
        usuario_id = session["usuario_id"]

        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT id, estado, observaciones, fecha_postulacion
            FROM postulaciones
            WHERE usuario_id = %s
            ORDER BY fecha_postulacion DESC;
        """, (usuario_id,))

        filas = cursor.fetchall()
        cursor.close()
        conexion.close()

        postulaciones = []
        for fila in filas:
            postulaciones.append({
                "id": fila[0],
                "estado": fila[1],
                "observaciones": fila[2],
                "fecha_postulacion": fila[3].isoformat() if fila[3] else None
            })

        return {
            "total": len(postulaciones),
            "postulaciones": postulaciones
        }, 200

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/api/postulaciones", methods=["GET"])
@requiere_rol("JEFE")
def listar_postulaciones():
    try:
        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT
                p.id,
                p.estado,
                p.observaciones,
                p.fecha_postulacion,
                u.id AS usuario_id,
                u.nombre,
                u.email,
                u.telefono
            FROM postulaciones p
            JOIN usuarios u ON p.usuario_id = u.id
            ORDER BY p.fecha_postulacion DESC;
        """)

        filas = cursor.fetchall()
        cursor.close()
        conexion.close()

        postulaciones = []
        for fila in filas:
            postulaciones.append({
                "id": fila[0],
                "estado": fila[1],
                "observaciones": fila[2],
                "fecha_postulacion": fila[3].isoformat() if fila[3] else None,
                "usuario": {
                    "id": fila[4],
                    "nombre": fila[5],
                    "email": fila[6],
                    "telefono": fila[7]
                }
            })

        return {
            "total": len(postulaciones),
            "postulaciones": postulaciones
        }, 200

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/api/postulaciones/<int:postulacion_id>/estado", methods=["PUT"])
@requiere_rol("JEFE")
def cambiar_estado_postulacion(postulacion_id):
    try:
        datos = request.get_json(silent=True) or {}
        nuevo_estado = datos.get("estado")
        observaciones = datos.get("observaciones", "")

        if nuevo_estado not in ["ACEPTADA", "RECHAZADA"]:
            return {"error": "Estado no vÃ¡lido. Usa ACEPTADA o RECHAZADA"}, 400

        conexion = conectar_db()
        cursor = conexion.cursor()

        # Buscar la postulaciÃ³n
        cursor.execute("""
            SELECT id, usuario_id, estado
            FROM postulaciones
            WHERE id = %s
        """, (postulacion_id,))

        postulacion = cursor.fetchone()

        if not postulacion:
            cursor.close()
            conexion.close()
            return {"error": "PostulaciÃ³n no encontrada"}, 404

        if postulacion[2] != "PENDIENTE":
            cursor.close()
            conexion.close()
            return {"error": "Esta postulaciÃ³n ya fue procesada"}, 400

        # Actualizar postulaciÃ³n
        cursor.execute("""
            UPDATE postulaciones
            SET estado = %s, observaciones = %s
            WHERE id = %s
            RETURNING id, estado;
        """, (nuevo_estado, observaciones, postulacion_id))

        actualizada = cursor.fetchone()

        # Si se acepta, cambiar el rol del usuario a BOMBERO
        if nuevo_estado == "ACEPTADA":
            cursor.execute("""
                UPDATE usuarios
                SET rol = 'BOMBERO', activo = TRUE
                WHERE id = %s
            """, (postulacion[1],))

        conexion.commit()
        cursor.close()
        conexion.close()

        return {
            "mensaje": f"PostulaciÃ³n {nuevo_estado.lower()} correctamente",
            "postulacion": {
                "id": actualizada[0],
                "estado": actualizada[1]
            }
        }, 200

    except Exception as e:
        return {"error": str(e)}, 500



if __name__ == "__main__":
    print(app.url_map)
    app.run(debug=True, port=5000)
