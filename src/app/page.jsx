"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation"; // 👈 nuevo

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function makeHeaders(session, empresaIdOverride) {
  const token = session?.user?.accessToken || "";
  const empresaId = empresaIdOverride ?? session?.user?.empresaId ?? null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
  };
}

async function jsonOrNull(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter(); // 👈

  const [bundle, setBundle] = useState(null);
  const [err, setErr] = useState("");

  // 👇 redirección si NO hay sesión
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // si no hay token todavía, no cargamos nada
        if (!session?.user?.accessToken) return;

        const meRes = await fetch(`${API_URL}/me`, {
          cache: "no-store",
          headers: makeHeaders(session),
        });
        if (!meRes.ok) {
          const j = await jsonOrNull(meRes);
          throw new Error(
            j?.msg || j?.message || `Error ${meRes.status} en /me`
          );
        }
        const me = await meRes.json();

        const empresaIdFromMe =
          me?.user?.empresa?.id ??
          me?.scope?.empresaId ??
          session?.user?.empresaId ??
          null;

        const headers = makeHeaders(session, empresaIdFromMe);

        const candidates = [
          { key: "me", path: "/me" },
          empresaIdFromMe
            ? { key: "empresa", path: `/empresa/${empresaIdFromMe}` }
            : null,
          { key: "usuarios", path: "/usuarios" },
          { key: "clientes", path: "/clientes" },
          { key: "proveedores", path: "/proveedores" },
          { key: "productos", path: "/productos" },
          { key: "proyectos", path: "/proyectos" },
          { key: "ventas", path: "/ventas" },
          { key: "compras", path: "/compras" },
          { key: "cotizaciones", path: "/cotizaciones" },
        ].filter(Boolean);

        const results = await Promise.allSettled(
          candidates.map(async (c) => {
            const r = await fetch(`${API_URL}${c.path}`, {
              cache: "no-store",
              headers,
            });
            if (!r.ok) {
              const j = await jsonOrNull(r);
              throw new Error(
                j?.msg || j?.message || `Error ${r.status} en ${c.path}`
              );
            }
            const data = await r.json();
            return { key: c.key, data };
          })
        );

        const b = { me, _errors: {} };
        for (const r of results) {
          if (r.status === "fulfilled") b[r.value.key] = r.value.data;
          else {
            const i = results.indexOf(r);
            const key = candidates[i]?.key || `unk_${i}`;
            b._errors[key] = String(
              r.reason?.message || r.reason || "unknown"
            );
          }
        }

        if (!cancelled) setBundle(b);
      } catch (e) {
        if (!cancelled) setErr(String(e.message || e));
      }
    }

    // solo intento cargar si estamos autenticados
    if (status === "authenticated") {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [session, status]);

  // Mientras NextAuth resuelve la sesión (o justo antes de redirigir)
  if (status === "loading" || status === "unauthenticated") {
    return <div className="px-4 py-8">Cargando…</div>;
  }

  // (opcional) este if ya no es necesario, porque para llegar acá ya hay sesión
  // lo dejo solo como backup por si acaso
  if (!session) return null;

  if (err)
    return (
      <div className="px-4 py-8">
        <p className="text-red-600 font-medium">Error al cargar datos:</p>
        <p className="text-sm">{err}</p>
      </div>
    );

  if (!bundle) return <div className="px-4 py-8">Cargando información…</div>;


  // ⚠ tu /me es { user, scope }
  const me = bundle.me?.user ?? {};
  const empresa = me?.empresa ?? null;
  const rolNombre = me?.rol?.nombre ?? "";
  const rolCodigo = me?.rol?.codigo ?? "";
  const userName = me?.nombre ?? session?.user?.name ?? "Usuario";

  const count = (x) =>
    Array.isArray(x)
      ? x.length
      : Array.isArray(x?.items)
      ? x.items.length
      : Array.isArray(x?.data)
      ? x.data.length
      : 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bienvenido, {userName}
        </h1>
        <p className="text-gray-600">
          Rol: <span className="font-medium">{rolNombre || rolCodigo}</span>
          {empresa?.nombre ? (
            <>
              {" "}
              · Empresa: <span className="font-medium">{empresa.nombre}</span>
            </>
          ) : null}
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardStat label="Usuarios" value={count(bundle.usuarios)} />
        <CardStat label="Clientes" value={count(bundle.clientes)} />
        <CardStat label="Proveedores" value={count(bundle.proveedores)} />
        <CardStat label="Productos" value={count(bundle.productos)} />
        <CardStat label="Proyectos" value={count(bundle.proyectos)} />
        <CardStat label="Ventas" value={count(bundle.ventas)} />
        <CardStat label="Compras" value={count(bundle.compras)} />
        <CardStat label="Cotizaciones" value={count(bundle.cotizaciones)} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ListPreview
          title="Últimos clientes"
          rows={takeFirst(bundle.clientes, 8)}
          cols={["nombre", "rut", "correo"]}
          href="/clientes"
        />
        <ListPreview
          title="Últimos proveedores"
          rows={takeFirst(bundle.proveedores, 8)}
          cols={["nombre", "rut", "correo"]}
          href="/proveedores"
        />
        <ListPreview
          title="Productos"
          rows={takeFirst(bundle.productos, 8)}
          cols={["nombre", "sku", "precio"]}
          href="/productos"
        />
        <ListPreview
          title="Proyectos"
          rows={takeFirst(bundle.proyectos, 8)}
          cols={["nombre", "estado", "createdAt"]}
          href="/proyectos"
        />
      </section>

      {/* Si quieres verificar rápido: */}
      {/* <pre className="text-xs bg-gray-100 p-4 rounded-lg overflow-auto max-h-[50vh]">
        {JSON.stringify(bundle, null, 2)}
      </pre> */}
    </div>
  );
}

/* ====== UI helpers ====== */
function CardStat({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">
        {Number.isFinite(value) ? value : "—"}
      </div>
    </div>
  );
}

function takeFirst(payload, n = 8) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.slice(0, n);
  if (Array.isArray(payload?.items)) return payload.items.slice(0, n);
  if (Array.isArray(payload?.data)) return payload.data.slice(0, n);
  return [];
}

function ListPreview({ title, rows = [], cols = [], href = "#" }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-medium">{title}</h3>
        <Link className="text-sm text-blue-700 hover:underline" href={href}>
          ver todo
        </Link>
      </div>
      <div className="p-3">
        {rows.length === 0 ? (
          <div className="text-sm text-gray-500 px-1 py-6 text-center">
            Sin registros
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <li key={r.id || i} className="py-2 px-1 text-sm">
                <div className="font-medium">
                  {r.nombre ||
                    r.razonSocial ||
                    r.titulo ||
                    r.codigo ||
                    `#${r.id ?? i + 1}`}
                </div>
                <div className="text-gray-500">
                  {cols
                    .filter((c) => r[c] && c !== "nombre")
                    .slice(0, 3)
                    .map((c, j) => (
                      <span key={c}>
                        {String(r[c])}
                        {j < Math.min(2, cols.length - 1) ? " · " : ""}
                      </span>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
