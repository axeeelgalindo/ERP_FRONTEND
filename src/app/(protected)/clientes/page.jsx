// src/app/(protected)/clientes/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { makeHeaders } from "@/lib/api";

import PageHeader, { PrimaryActionButton } from "@/components/layout/PageHeader";
import ClientsFilters from "@/components/clientes/ClientesFilters";
import ClientsTable from "@/components/clientes/ClientesTable";
import Modal from "@/components/ui/Modal";
import { Plus } from "lucide-react";

import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ClientesPage() {
  const { data: session } = useSession();

  // estado base
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  // filtros
  const [q, setQ] = useState("");
  const [rut, setRut] = useState("");
  const [tel, setTel] = useState("");

  // paginación
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // modales
  const [editing, setEditing] = useState(null); // null=cerrado, {}=crear, obj=editar
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);

  // snackbar
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "info" });
  const openSnack  = (msg, severity = "info") => setSnack({ open: true, msg, severity });
  const closeSnack = () => setSnack((s) => ({ ...s, open: false }));

  async function load() {
    try {
      setLoading(true);
      const headers = makeHeaders(session);
      const url = new URL(`${API_URL}/clientes`);
      if (q) url.searchParams.set("q", q); // si tu API busca por nombre/correo

      const res = await fetch(url, { headers, cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || json?.msg || "Error al cargar");

      const list = Array.isArray(json) ? json : json?.data ?? json?.items ?? [];
      setRows(list);
      setErr("");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  // carga inicial y cuando cambie q (búsqueda en servidor)
  useEffect(() => { if (session?.user) load(); }, [session, q]);

  // Filtro local por rut/teléfono + q (si quieres repetirlo local también)
  const filtered = useMemo(() => {
    const norm = (s) => String(s || "").toLowerCase();
    const r = norm(rut);
    const t = norm(tel).replace(/\s+/g, "");
    return rows.filter((row) => {
      const hitQ = q
        ? norm(row?.nombre).includes(norm(q)) || norm(row?.correo).includes(norm(q))
        : true;
      const hitRut = r ? norm(row?.rut).includes(r) : true;
      const hitTel = t ? norm(row?.telefono).replace(/\s+/g, "").includes(t) : true;
      return hitQ && hitRut && hitTel;
    });
  }, [rows, q, rut, tel]);

  // volver a página 1 cuando cambien filtros
  useEffect(() => { setPage(1); }, [q, rut, tel]);

  // slice de paginación
  const total = filtered.length;
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  async function onDeleteConfirm() {
    if (!deleting) return;
    try {
      setSaving(true);
      const headers = makeHeaders(session);
      const res = await fetch(`${API_URL}/clientes/${deleting.id}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.msg || json?.message || "No se pudo eliminar");

      setDeleting(null);
      setRows((prev) => prev.filter((x) => x.id !== deleting.id));
      openSnack("Cliente eliminado", "success");
    } catch (e) {
      openSnack(String(e.message || e), "error");
    } finally {
      setSaving(false);
    }
  }

  async function onEditSave(payload) {
    try {
      setSaving(true);
      const headers = makeHeaders(session);
      const url = editing?.id
        ? `${API_URL}/clientes/update/${editing.id}`
        : `${API_URL}/clientes/add`;

      const res = await fetch(url, {
        method: editing?.id ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.msg || json?.message || "No se pudo guardar");

      setEditing(null);

      if (editing?.id) {
        setRows((prev) => prev.map((x) => (x.id === json.id ? json : x)));
        openSnack("Cliente actualizado", "success");
      } else {
        setRows((prev) => [json, ...prev]);
        openSnack("Cliente creado", "success");
      }
    } catch (e) {
      openSnack(String(e.message || e), "error");
    } finally {
      setSaving(false);
    }
  }

  // abrir crear / editar
  function openCreate() {
    setEditing({ nombre: "", rut: "", correo: "", telefono: "", notas: "" });
  }
  function openEdit(row) {
    setEditing(row);
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Clientes"
        subtitle="Gestiona y busca los clientes de tu empresa"
        breadcrumbs={[{ label: "Inicio", href: "/" }, { label: "Clientes" }]}
        actions={
          <PrimaryActionButton onClick={openCreate} icon={Plus}>
            Nuevo cliente
          </PrimaryActionButton>
        }
      >
        <ClientsFilters
          q={q}
          onQ={setQ}
          rut={rut}
          onRut={setRut}
          tel={tel}
          onTel={setTel}
          loading={loading}
        />
      </PageHeader>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <ClientsTable
          rows={pageRows}
          loading={loading}
          error={err}
          onEdit={openEdit}
          onDelete={setDeleting}
          // props de paginación (asegúrate que tu tabla los soporte)
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      </div>

      {/* Modal Eliminar */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Eliminar cliente">
        <p className="text-sm text-gray-700">
          ¿Seguro que deseas eliminar a{" "}
          <span className="font-medium">{deleting?.nombre}</span>?
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-100"
            onClick={() => setDeleting(null)}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
            onClick={onDeleteConfirm}
            disabled={saving}
          >
            {saving ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </Modal>

      {/* Modal Editar / Crear */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Editar cliente" : "Nuevo cliente"}
      >
        {editing && (
          <EditForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={onEditSave}
            saving={saving}
          />
        )}
      </Modal>

      {/* Snackbar MUI */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={closeSnack}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <MuiAlert
          elevation={3}
          variant="filled"
          onClose={closeSnack}
          severity={snack.severity}
          sx={{ width: "100%" }}
        >
          {snack.msg}
        </MuiAlert>
      </Snackbar>
    </div>
  );
}

/* ========= Subcomponentes locales ========= */

function EditForm({ initial, onCancel, onSubmit, saving }) {
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
      className="space-y-3"
    >
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Nombre"   value={form.nombre}   onChange={(v) => update("nombre", v)} required />
        <Field label="RUT"      value={form.rut}      onChange={(v) => update("rut", v)} />
        <Field label="Correo"   value={form.correo}   onChange={(v) => update("correo", v)} />
        <Field label="Teléfono" value={form.telefono} onChange={(v) => update("telefono", v)} />
      </div>

      <Field label="Notas" value={form.notas} onChange={(v) => update("notas", v)} textarea />

      <div className="pt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-100"
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, textarea, required }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required ? " *" : ""}
      </span>
      {textarea ? (
        <textarea
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          rows={3}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          required={required}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
