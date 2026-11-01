
from flask import Blueprint, request, session
from database.conexion import conectar_db
from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/registro", methods=["POST"])
def registro():
    try:
        datos = request.get_json(silent=True) or {}

        nombre = datos.get("nombre")
        telefono = datos.get("telefono")
        email = datos.get("email")
        password = datos.get("password")

        if not nombre or not email or not password:
            return {
                "error": "Nombre, email y contraseña son obligatorios"
            }, 400

        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute(
            "SELECT id FROM usuarios WHERE email = %s",
            (email,)
        )

        if cursor.fetchone():
            cursor.close()
            conexion.close()
            return {"error": "El correo ya está registrado"}, 409

        password_hash = generate_password_hash(password)

        cursor.execute(
            """
            INSERT INTO usuarios
            (nombre, telefono, email, password_hash, rol)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, nombre, email, rol;
            """,
            (nombre, telefono, email, password_hash, "CIUDADANO")
        )

        usuario = cursor.fetchone()
        conexion.commit()

        cursor.close()
        conexion.close()

        return {
            "mensaje": "Usuario registrado correctamente",
            "usuario": {
                "id": usuario[0],
                "nombre": usuario[1],
                "email": usuario[2],
                "rol": usuario[3]
            }
        }, 201

    except Exception as e:
        return {"error": str(e)}, 500


@auth_bp.route("/api/login", methods=["POST"])
def login():
    try:
        datos = request.get_json(silent=True) or {}

        if not datos:
            return {"error": "Datos no válidos"}, 400

        email = datos.get("email")
        password = datos.get("password")

        if not email or not password:
            return {
                "error": "Email y contraseña son obligatorios"
            }, 400

        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute(
            """
            SELECT id, nombre, email, password_hash, rol, activo
            FROM usuarios
            WHERE email = %s
            """,
            (email,)
        )

        usuario = cursor.fetchone()

        cursor.close()
        conexion.close()

        if not usuario:
            return {
                "error": "Correo o contraseña incorrectos"
            }, 401

        if not check_password_hash(usuario[3], password):
            return {
                "error": "Correo o contraseña incorrectos"
            }, 401

        # Se conserva la regla original de acceso
        if usuario[4] not in ("CIUDADANO", "JEFE"):
            return {
                "error": "Tu rol no tiene permitido iniciar sesión"
            }, 403

        if not usuario[5]:
            return {"error": "Tu cuenta está inactiva"}, 403

        session.clear()
        session["usuario_id"] = usuario[0]
        session["rol"] = usuario[4]

        return {
            "mensaje": "Inicio de sesión exitoso",
            "usuario": {
                "id": usuario[0],
                "nombre": usuario[1],
                "email": usuario[2],
                "rol": usuario[4]
            }
        }, 200

    except Exception as e:
        return {"error": str(e)}, 500


@auth_bp.route("/api/logout", methods=["POST"])
def logout():
    session.clear()

    return {
        "mensaje": "Sesión cerrada correctamente"
    }, 200


@auth_bp.route("/api/sesion", methods=["GET"])
def comprobar_sesion():
    if "usuario_id" not in session:
        return {
            "autenticado": False,
            "mensaje": "No hay una sesión activa"
        }, 401

    try:
        conexion = conectar_db()
        cursor = conexion.cursor()

        cursor.execute(
            """
            SELECT id, nombre, email, rol
            FROM usuarios
            WHERE id = %s
            """,
            (session["usuario_id"],)
        )

        usuario = cursor.fetchone()

        cursor.close()
        conexion.close()

        if not usuario:
            session.clear()
            return {
                "autenticado": False,
                "mensaje": "Usuario no encontrado"
            }, 401

        return {
            "autenticado": True,
            "usuario": {
                "id": usuario[0],
                "nombre": usuario[1],
                "email": usuario[2],
                "rol": usuario[3]
            }
        }, 200

    except Exception as e:
        return {"error": str(e)}, 500
