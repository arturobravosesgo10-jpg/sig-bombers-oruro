
from flask import Blueprint, request, session
from database.conexion import conectar_db
from utils.permisos import requiere_rol


incidentes_bp = Blueprint("incidentes", __name__)


@incidentes_bp.route("/api/incidentes", methods=["POST"])
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
        mensaje = f"🚨 Nuevo incidente reportado: {codigo}"

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


@incidentes_bp.route("/api/incidentes", methods=["GET"])
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
                ROUND(
                    (EXTRACT(EPOCH FROM (
                        i.fecha_en_camino - i.fecha_hora
                    )) / 60.0)::numeric,
                    2
                ) AS tiempo_respuesta_minutos,
                ROUND(
                    (EXTRACT(EPOCH FROM (
                        i.fecha_atendido - i.fecha_en_camino
                    )) / 60.0)::numeric,
                    2
                ) AS tiempo_atencion_minutos,
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
                "distancia_estacion_metros": (
                    float(fila[10]) if fila[10] is not None else None
                ),
                "fecha_en_camino": fila[11].isoformat() if fila[11] else None,
                "fecha_atendido": fila[12].isoformat() if fila[12] else None,
                "tiempo_respuesta_minutos": (
                    float(fila[13]) if fila[13] is not None else None
                ),
                "tiempo_atencion_minutos": (
                    float(fila[14]) if fila[14] is not None else None
                ),
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



@incidentes_bp.route(
    "/api/incidentes/<int:incidente_id>/estado",
    methods=["PUT"]
)
@requiere_rol("JEFE")
def cambiar_estado_incidente(incidente_id):
    try:
        datos = request.get_json(silent=True) or {}
        nuevo_estado = datos.get("estado")

        if nuevo_estado not in [
            "REPORTADO",
            "EN_CAMINO",
            "ATENDIDO"
        ]:
            return {"error": "Estado no válido"}, 400

        conexion = conectar_db()
        cursor = conexion.cursor()

        # Buscar incidente
        cursor.execute("""
            SELECT id, codigo, estado, reportado_por
            FROM incidentes
            WHERE id = %s
        """, (incidente_id,))

        incidente = cursor.fetchone()

        if not incidente:
            cursor.close()
            conexion.close()
            return {"error": "El incidente no existe"}, 404

        estado_actual = incidente[2]

        # Validar flujo de estados
        if estado_actual == "REPORTADO" and nuevo_estado != "EN_CAMINO":
            cursor.close()
            conexion.close()
            return {
                "error": "Un incidente reportado solo puede pasar a EN_CAMINO."
            }, 400

        if estado_actual == "EN_CAMINO" and nuevo_estado != "ATENDIDO":
            cursor.close()
            conexion.close()
            return {
                "error": "Un incidente en camino solo puede pasar a ATENDIDO."
            }, 400

        if estado_actual == "ATENDIDO":
            cursor.close()
            conexion.close()
            return {
                "error": "El incidente ya fue atendido y no puede cambiar de estado."
            }, 400

        # Actualizar estado y fechas
        cursor.execute("""
            UPDATE incidentes
            SET
                estado = %s,
                fecha_en_camino = CASE
                    WHEN %s = 'EN_CAMINO'
                    THEN CURRENT_TIMESTAMP
                    ELSE fecha_en_camino
                END,
                fecha_atendido = CASE
                    WHEN %s = 'ATENDIDO'
                    THEN CURRENT_TIMESTAMP
                    ELSE fecha_atendido
                END
            WHERE id = %s
            RETURNING
                id,
                codigo,
                estado,
                reportado_por,
                fecha_en_camino,
                fecha_atendido,
                ROUND(
                    (EXTRACT(EPOCH FROM (
                        fecha_en_camino - fecha_hora
                    )) / 60.0)::numeric,
                    2
                ) AS tiempo_respuesta_minutos,
                ROUND(
                    (EXTRACT(EPOCH FROM (
                        fecha_atendido - fecha_en_camino
                    )) / 60.0)::numeric,
                    2
                ) AS tiempo_atencion_minutos;
        """, (
            nuevo_estado,
            nuevo_estado,
            nuevo_estado,
            incidente_id
        ))

        actualizado = cursor.fetchone()

        # Crear notificación para el ciudadano
        if actualizado[3]:
            if nuevo_estado == "EN_CAMINO":
                mensaje = (
                    f"El incidente {actualizado[1]} "
                    "está siendo atendido por los bomberos."
                )
            elif nuevo_estado == "ATENDIDO":
                mensaje = (
                    f"El incidente {actualizado[1]} "
                    "ha sido atendido."
                )
            else:
                mensaje = None

            if mensaje:
                cursor.execute("""
                    INSERT INTO notificaciones
                    (incidente_id, destinatario_id, mensaje)
                    VALUES (%s, %s, %s)
                """, (
                    incidente_id,
                    actualizado[3],
                    mensaje
                ))

        conexion.commit()
        cursor.close()
        conexion.close()

        return {
            "mensaje": "Estado del incidente actualizado correctamente",
            "incidente": {
                "id": actualizado[0],
                "codigo": actualizado[1],
                "estado": actualizado[2],
                "fecha_en_camino": (
                    actualizado[4].isoformat()
                    if actualizado[4] else None
                ),
                "fecha_atendido": (
                    actualizado[5].isoformat()
                    if actualizado[5] else None
                ),
                "tiempo_respuesta_minutos": (
                    float(actualizado[6])
                    if actualizado[6] is not None else None
                ),
                "tiempo_atencion_minutos": (
                    float(actualizado[7])
                    if actualizado[7] is not None else None
                )
            }
        }, 200

    except Exception as e:
        return {"error": str(e)}, 500

