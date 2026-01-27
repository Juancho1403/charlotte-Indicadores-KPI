// Nuevo archivo - utilidades para normalizar/obtener Authorization header
export const normalizeAuthorizationHeader = (authorization) => {
  if (!authorization || typeof authorization !== 'string') return null;
  const trimmed = authorization.trim();
  if (!trimmed) return null;

  // Si ya viene con Bearer (cualquier casing), retornamos tal cual
  if (/^bearer\s+/i.test(trimmed)) return trimmed;
  // Si viene solo el token, lo envolvemos como Bearer
  return `Bearer ${trimmed}`;
};

let _cachedToken = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

async function loginAndGetToken() {
  // Si hay token en env, usarlo
  const envToken = process.env.API_AUTH_TOKEN;
  if (envToken) return normalizeAuthorizationHeader(envToken);

  // Usar cache si aún válido
  const now = Date.now();
  if (_cachedToken && (now - _cachedAt) < CACHE_TTL_MS) {
    return normalizeAuthorizationHeader(_cachedToken);
  }

  // Credenciales fijas requeridas por el endpoint de seguridad
  const body = {
    email: "usuario.p10@charlotte.com",
    password: "SuperSeguraPassword"
  };

  try {
    const res = await fetch("https://charlotte-seguridad.onrender.com/api/seguridad/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // timeout behavior depende del runtime; ajustable si se usa axios
    });

    if (!res.ok) {
      // no token; limpiar cache y devolver null
      _cachedToken = null;
      _cachedAt = 0;
      return null;
    }

    const data = await res.json();
    // Intentar extraer token de varias formas comunes
    const token = data?.token || data?.access_token || data?.accessToken || data?.data?.token || null;
    if (!token) {
      _cachedToken = null;
      _cachedAt = 0;
      return null;
    }

    _cachedToken = token;
    _cachedAt = Date.now();
    return normalizeAuthorizationHeader(token);
  } catch (err) {
    _cachedToken = null;
    _cachedAt = 0;
    return null;
  }
};

/**
 * Devuelve un objeto con la cabecera Authorization lista para añadir a
 * las opciones de fetch: { headers: { Authorization: 'Bearer ...' } }
 * Se prioriza el parámetro authorization; si es falsy, se intenta login al servicio
 * remoto para obtener token. Retorna {} si no hay token.
 */
export const getFetchAuthOptions = async (authorization) => {
  const source = authorization ?? process.env.API_AUTH_TOKEN ?? null;
  const header = normalizeAuthorizationHeader(source) || await loginAndGetToken();
  if (!header) return {};
  return { headers: { Authorization: header } };
};

/**
 * Config para axios
 * Ahora es async porque puede requerir login al endpoint externo.
 * Retorna {} si no hay token.
 */
export const getAxiosAuthConfig = async (authorization) => {
  const source = authorization ?? process.env.API_AUTH_TOKEN ?? null;
  const header = normalizeAuthorizationHeader(source) || await loginAndGetToken();
  if (!header) return {};
  return { headers: { Authorization: header } };
};