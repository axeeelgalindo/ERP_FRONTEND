// src/app/(protected)/proveedores/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function getEmpresaId(session) {
  return (
    session?.user?.empresaId ||
    session?.empresaId ||
    session?.user?.empresa_id ||
    session?.empresa_id ||
    null
  );
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function EmptyState({ text }) {
  return (
    <div className="border border-slate-200  rounded-xl p-10 text-center text-slate-500 ">
      {text}
    </div>
  );
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        role="button"
        aria-label="Cerrar"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl bg-white  border border-slate-200  shadow-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 ">
            <h3 className="text-lg font-semibold text-slate-900 ">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg border border-slate-200  text-slate-700  hover:bg-slate-50 "
            >
              Cerrar
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function ProveedoresPage() {
  const { data: session, status } = useSession();
  const empresaId = useMemo(() => getEmpresaId(session), [session]);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const [q, setQ] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    nombre: "",
    rut: "",
    correo: "",
    telefono: "",
    notas: "",
  });

  const [error, setError] = useState("");

  async function apiFetch(path, opts = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(empresaId ? { "x-empresa-id": empresaId } : {}),
      ...(opts.headers || {}),
    };

    const res = await fetch(`${API_URL}${path}`, {
      ...opts,
      headers,
    });

    if (res.status === 204) return { ok: true };
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error || data?.message || "Error inesperado";
      throw new Error(msg);
    }
    return data;
  }

  async function load() {
    if (!empresaId) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch(`/proveedores?q=${encodeURIComponent(q)}`);
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e) {
      setError(e.message || "No se pudo cargar proveedores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "authenticated") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, empresaId]);

  // recargar al escribir, con pequeño debounce
  useEffect(() => {
    if (status !== "authenticated") return;
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function openCreate() {
    setEditing(null);
    setForm({ nombre: "", rut: "", correo: "", telefono: "", notas: "" });
    setError("");
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      nombre: row?.nombre || "",
      rut: row?.rut || "",
      correo: row?.correo || "",
      telefono: row?.telefono || "",
      notas: row?.notas || "",
    });
    setError("");
    setModalOpen(true);
  }

  async function submit() {
    setError("");
    const payload = {
      nombre: form.nombre,
      rut: form.rut,
      correo: form.correo,
      telefono: form.telefono,
      notas: form.notas,
    };

    try {
      if (!empresaId) throw new Error("Falta empresaId (x-empresa-id)");

      if (!payload.nombre?.trim()) {
        setError("El nombre es obligatorio");
        return;
      }

      if (editing?.id) {
        await apiFetch(`/proveedores/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/proveedores`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e.message || "No se pudo guardar");
    }
  }

  async function remove(row) {
    const ok = confirm(`¿Eliminar proveedor "${row?.nombre}"?`);
    if (!ok) return;

    try {
      await apiFetch(`/proveedores/${row.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      alert(e.message || "No se pudo eliminar");
    }
  }

  const sortedRows = rows; // backend ya viene alfabético por nombre asc ✅

  return (
    <div className="p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 ">
            Proveedores
          </h1>
          <p className="text-slate-500  mt-1">
            Gestión de proveedores (listado alfabético).
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, rut o correo..."
              className="w-full md:w-80 px-3 py-2 rounded-xl border border-slate-200  bg-white  text-slate-900 "
            />
            <button
              onClick={load}
              disabled={loading}
              className={classNames(
                "px-4 py-2 rounded-xl border",
                "border-slate-200 ",
                "bg-white ",
                "text-slate-900 ",
                "hover:bg-slate-50 ",
                loading && "opacity-60 cursor-not-allowed"
              )}
            >
              {loading ? "Cargando..." : "Refrescar"}
            </button>
          </div>

          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 "
          >
            Nuevo proveedor
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3">
          {error}
        </div>
      ) : null}

      {loading ? (
        <EmptyState text="Cargando proveedores..." />
      ) : sortedRows.length === 0 ? (
        <EmptyState text="No hay proveedores para mostrar." />
      ) : (
        <div className="overflow-auto rounded-2xl border border-slate-200 ">
          <table className="min-w-full bg-white ">
            <thead className="bg-slate-50 ">
              <tr className="text-left text-sm text-slate-600 ">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">RUT</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3 w-[160px]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 ">
              {sortedRows.map((r) => (
                <tr key={r.id} className="text-sm text-slate-900 ">
                  <td className="px-4 py-3 font-medium">{r.nombre}</td>
                  <td className="px-4 py-3 text-slate-600 ">
                    {r.rut || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 ">
                    {r.correo || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 ">
                    {r.telefono || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(r)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200  hover:bg-slate-50 "
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remove(r)}
                        className="px-3 py-1.5 rounded-lg border border-red-200  text-red-700  hover:bg-red-50/60"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? "Editar proveedor" : "Nuevo proveedor"}
        onClose={() => setModalOpen(false)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm text-slate-600 ">
              Nombre *
            </label>
            <input
              value={form.nombre}
              onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200  bg-white "
              placeholder="Ej: Proveedor ABC"
            />
          </div>

          <div>
            <label className="text-sm text-slate-600 ">RUT</label>
            <input
              value={form.rut}
              onChange={(e) => setForm((s) => ({ ...s, rut: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200  bg-white "
              placeholder="Ej: 76.123.456-7"
            />
          </div>

          <div>
            <label className="text-sm text-slate-600 ">
              Correo
            </label>
            <input
              value={form.correo}
              onChange={(e) => setForm((s) => ({ ...s, correo: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200  bg-white "
              placeholder="Ej: contacto@proveedor.cl"
            />
          </div>

          <div>
            <label className="text-sm text-slate-600 ">
              Teléfono
            </label>
            <input
              value={form.telefono}
              onChange={(e) =>
                setForm((s) => ({ ...s, telefono: e.target.value }))
              }
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200  bg-white "
              placeholder="Ej: +56 9 1234 5678"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-slate-600 ">Notas</label>
            <textarea
              value={form.notas}
              onChange={(e) => setForm((s) => ({ ...s, notas: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200  bg-white min-h-[90px]"
              placeholder="Observaciones internas..."
            />
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={() => setModalOpen(false)}
            className="px-4 py-2 rounded-xl border border-slate-200  hover:bg-slate-50 "
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 "
          >
            Guardar
          </button>
        </div>
      </Modal>
    </div>
  );
}