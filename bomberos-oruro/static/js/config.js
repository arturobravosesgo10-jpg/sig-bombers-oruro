// Configuración general
const API =
  location.hostname === "127.0.0.1" || location.hostname === "localhost"
    ? "http://127.0.0.1:5000"
    : "https://sig-bombers-oruro.onrender.com";

let rolActual = null;
const oruro = [-17.9667, -67.1167];