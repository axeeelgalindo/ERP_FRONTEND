// src/lib/api.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function serverApi(path, { method = "GET", body, headers = {}, cache = "no-store" } = {}) {
  const session = await getServerSession(authOptions);
  const token   = session?.user?.accessToken || "";
  const empresaId = session?.user?.empresaId ?? null;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    cache,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  // Intenta parsear JSON incluso en error para devolver detalle
  let json = null;
  try { json = await res.json(); } catch { json = null; }

  if (!res.ok) {
    const msg = json?.msg || json?.message || `Error ${res.status} en ${path}`;
    throw new Error(msg);
  }
  return json;
}

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
    let detail = "";
    try { detail = (await res.json())?.message || (await res.json())?.msg || ""; } catch {}
    throw new Error(detail || `Error ${res.status}`);
  }
  return res.json();
}