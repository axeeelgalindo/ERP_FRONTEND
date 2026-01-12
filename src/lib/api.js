// src/lib/api.js
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function shouldRedirectToLogin(res, json) {
  // si tu backend manda 401 o 403 => fuera
  if (res.status === 401 || res.status === 403) return true;

  // tu backend a veces responde 401 con msg "Falta empresa en el contexto"
  const msg = (json?.msg || json?.message || "").toLowerCase();
  if (msg.includes("falta empresa")) return true;
  if (msg.includes("token")) return true;
  if (msg.includes("unauthorized") || msg.includes("no autorizado")) return true;

  return false;
}

export async function serverApi(
  path,
  { method = "GET", body, headers = {}, cache = "no-store" } = {}
) {
  const session = await getServerSession(authOptions);
  const token = session?.user?.accessToken || "";
  const empresaId = session?.user?.empresaId ?? null;

  // ✅ si no hay token o empresa => login directo
  // (en tu backend es obligatorio empresa_id en el contexto)
  if (!token || !empresaId) {
    redirect("/login"); // cambia si tu ruta es distinta
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    cache,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-empresa-id": String(empresaId),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const json = await safeJson(res);

  // ✅ si el backend dice "no autorizado" => login
  if (!res.ok && shouldRedirectToLogin(res, json)) {
    redirect("/login");
  }

  if (!res.ok) {
    const msg = json?.msg || json?.message || `Error ${res.status} en ${path}`;
    throw new Error(msg);
  }

  return json;
}

/**
 * Útil para CLIENT COMPONENTS (fetch desde el browser) con useSession()
 */
export function makeHeaders(session, empresaIdOverride) {
  const token = session?.user?.accessToken || "";
  const empresaId = empresaIdOverride ?? session?.user?.empresaId ?? null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
  };
}

export async function jsonOrThrow(res) {
  if (!res.ok) {
    const json = await safeJson(res);
    const detail = json?.message || json?.msg || "";
    throw new Error(detail || `Error ${res.status}`);
  }
  return res.json();
}
