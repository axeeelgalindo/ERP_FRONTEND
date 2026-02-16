// src/components/clientes/utils.js
export function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export function boolish(v) {
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  return false;
}

export function cleanPayloadCliente(form) {
  return {
    nombre: (form.nombre || "").trim(),
    rut: form.rut?.trim() || null,
    correo: form.correo?.trim() || null,
    telefono: form.telefono?.trim() || null,
    notas: form.notas?.trim() || null,
  };
}

export function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "—";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || parts[0]?.[1] || "";
  return (a + b).toUpperCase();
}


export function logoSrc(pathOrUrl) {
  const raw = String(pathOrUrl || "").trim();
  if (!raw) return "";

  const API_URL = process.env.NEXT_PUBLIC_API_URL || ""; // http://127.0.0.1:3001/api
  const API_ORIGIN = API_URL.replace(/\/api\/?$/i, ""); // http://127.0.0.1:3001

  const toApiUploads = (p) => {
    const clean = p.startsWith("/") ? p : `/${p}`;
    // queremos: /api/uploads/...
    if (clean.startsWith("/api/")) return `${API_ORIGIN}${clean}`;
    return `${API_URL}${clean}`; // API_URL ya trae /api
  };

  // 1) Si es absoluta, normalizamos host+path si corresponde
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);

      // si viene del FRONT (3000) y apunta a /uploads => lo movemos a la API
      if (
        (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
        u.port === "3000" &&
        u.pathname.startsWith("/uploads/")
      ) {
        return toApiUploads(u.pathname);
      }

      // si viene desde la API pero sin /api (ej: http://127.0.0.1:3001/uploads/...)
      if (u.origin === API_ORIGIN && u.pathname.startsWith("/uploads/")) {
        return toApiUploads(u.pathname);
      }

      // cualquier otra absoluta, la devolvemos tal cual
      return raw;
    } catch {
      return raw;
    }
  }

  // 2) Si es relativa
  // ej: "uploads/.." o "/uploads/.."
  const rel = raw.startsWith("/") ? raw : `/${raw}`;
  return toApiUploads(rel);
}