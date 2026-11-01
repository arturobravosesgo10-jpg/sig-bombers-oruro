
from functools import wraps
from flask import session


def requiere_rol(*roles):
    def decorador(funcion):
        @wraps(funcion)
        def wrapper(*args, **kwargs):
            if "usuario_id" not in session:
                return {"error": "Debes iniciar sesión"}, 401

            if session.get("rol") not in roles:
                return {
                    "error": "No tienes permisos para realizar esta acción"
                }, 403

            return funcion(*args, **kwargs)

        return wrapper

    return decorador
